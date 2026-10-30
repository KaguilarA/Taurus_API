import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import session from "express-session";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../../app.js";
import { Accounts, SetupLock } from "../../models/models.js";
import { seed } from "../fixtures/seed.js";
import { seed as migrateStoredBusiness } from "../../db/migrations.js";

let replica, app, second;
const password = "First-owner-password-2026!";
const body = (username = "owner") => ({
  username,
  name: "Owner",
  password,
  passwordConfirmation: password,
});
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replica.getUri("initial-setup-tests"));
  await seed({});
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init()),
  );
  const sessions = session({
    secret: "setup-tests-session-secret-longer-than-32-characters",
    resave: false,
    saveUninitialized: false,
  });
  app = createApp({
    origin: "http://localhost:4200",
    sessionMiddleware: sessions,
  });
  second = createApp({
    origin: "http://localhost:4200",
    sessionMiddleware: sessions,
  });
});
beforeEach(async () => {
  await mongoose.model("User").deleteMany({});
  await SetupLock.deleteMany({});
});
after(async () => {
  await mongoose.disconnect();
  if (replica) await replica.stop();
});

test("una base nueva pide configuración; otros roles no sustituyen al administrador", async () => {
  assert.deepEqual(
    (await request(app).get("/api/setup/status").expect(200)).body,
    { required: true, businessRequired: false },
  );
  await Accounts.save({
    username: "waiter",
    email: "waiter@accounts.local",
    password,
    role: "waiter",
  });
  assert.equal(
    (await request(app).get("/api/setup/status")).body.required,
    true,
  );
});

test("el registro valida usuario, contraseña fuerte y confirmación sin crear cuentas parciales", async () => {
  for (const patch of [
    { username: "a" },
    { password: "12345678", passwordConfirmation: "12345678" },
    { passwordConfirmation: "different" },
  ])
    await request(app)
      .post("/api/setup/admin")
      .send({ ...body(), ...patch })
      .expect(400);
  assert.equal(await mongoose.model("User").countDocuments(), 0);
});

test("crea el primer admin con hash de OWL, inicia sesión y cierra el registro", async () => {
  const browser = request.agent(app);
  const result = await browser
    .post("/api/setup/admin")
    .send({ ...body(), role: "waiter" })
    .expect(201);
  assert.equal(result.body.role, "admin");
  assert.equal(result.body.password, undefined);
  const account = await Accounts.getOne({ username: "owner" });
  assert.equal(
    await Accounts.compareHash(String(account._id), "password", password),
    true,
  );
  await browser.get("/api/admin/state").expect(200);
  assert.equal(
    (await browser.get("/api/auth/status")).body.authenticated,
    true,
  );
  assert.equal((await browser.get("/api/setup/status")).body.required, false);
  await request(app).post("/api/setup/admin").send(body("another")).expect(404);
});

test("dos instancias no pueden registrar dos administradores a la vez", async () => {
  const results = await Promise.all([
    request(app).post("/api/setup/admin").send(body("first")),
    request(second).post("/api/setup/admin").send(body("second")),
  ]);
  assert.equal(results.filter((result) => result.status === 201).length, 1);
  assert.ok(results.some((result) => [404, 409].includes(result.status)));
  assert.equal(
    await mongoose.model("User").countDocuments({ role: "admin" }),
    1,
  );
});

test("un usuario ocupado revierte la transacción y permite reintentar el primer registro", async () => {
  await Accounts.save({
    username: "owner",
    email: "owner@accounts.local",
    password,
    role: "kitchen",
  });
  await request(app).post("/api/setup/admin").send(body()).expect(409);
  assert.equal(
    (await request(app).get("/api/setup/status")).body.required,
    true,
  );
  await request(app)
    .post("/api/setup/admin")
    .send(body("new-owner"))
    .expect(201);
});

test("un usuario original sin rol no obtiene privilegios administrativos automáticamente", async () => {
  const account = await Accounts.save({
    username: "legacy",
    email: "legacy@accounts.local",
    password,
  });
  await mongoose
    .model("User")
    .updateOne({ _id: account._id }, { $unset: { role: 1 } });
  assert.equal(
    (await request(app).get("/api/setup/status")).body.required,
    true,
  );
  assert.equal((await Accounts.getById(account._id)).role, "waiter");
});

test("el administrador se registra antes de completar business y la carta usa esos datos", async () => {
  await mongoose.model("Business").deleteMany({});
  const browser = request.agent(app);
  await browser.post("/api/setup/admin").send(body()).expect(201);
  assert.deepEqual((await browser.get("/api/setup/status")).body, {
    required: false,
    businessRequired: true,
  });
  assert.equal((await browser.get("/api/public")).body.settings, null);
  const business = {
    name: "Otra cantina",
    subtitle: "Cocina y música",
    tagline: "Una frase propia",
    description: "Descripción guardada",
    phone: "1111-2222",
    currency: "USD",
    accent: "#445566",
    servings: { large: 100, small: 50, shot: 25 },
  };
  await request(app).put("/api/admin/settings").send(business).expect(401);
  await browser.put("/api/admin/settings").send(business).expect(200);
  const published = (await browser.get("/api/public")).body.settings;
  for (const key of [
    "name",
    "subtitle",
    "tagline",
    "description",
    "phone",
    "currency",
    "accent",
  ])
    assert.equal(published[key], business[key]);
  assert.equal(
    await mongoose.connection.collection("businesses").countDocuments(),
    1,
  );
  assert.equal(
    await mongoose.connection.collection("restaurantsettings").countDocuments(),
    0,
  );
  assert.equal(
    (await browser.get("/api/setup/status")).body.businessRequired,
    false,
  );
});

test("la migración conserva el perfil antiguo almacenado sin volver a quemar datos", async () => {
  await mongoose.model("Business").deleteMany({});
  await mongoose.connection.collection("restaurantsettings").insertOne({
    key: "main",
    name: "Negocio existente",
    currency: "EUR",
    accent: "#123456",
    phone: "9999-1111",
    servings: { large: 80, small: 40, shot: 20 },
  });
  await migrateStoredBusiness();
  await migrateStoredBusiness();
  const business = await mongoose.model("Business").findOne({ key: "main" });
  assert.equal(business.name, "Negocio existente");
  assert.equal(business.phone, "9999-1111");
  assert.equal(await mongoose.model("Business").countDocuments(), 1);
  assert.equal(
    await mongoose.connection.collection("restaurantsettings").countDocuments(),
    1,
  );
});
