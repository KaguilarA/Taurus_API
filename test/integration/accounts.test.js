import { ProductTypeModel } from "../../models/models.js";
import { initializeCatalog } from "../fixtures/catalog.js";
import { OwlMongoConnect, OwlMongoClose } from "owl-expressjs-utils";
import {
  UserModel,
  ProductModel,
  PasswordResetModel,
  registeredModels,
} from "../../models/models.js";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import session from "express-session";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../../app.js";

import { productInput } from "../../services/validation.js";
let replica, app, admin, waiter, victim;
const password = "Account-tests-password-2026!";
const nextPassword = "Updated-account-password-2026!";
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await OwlMongoConnect(replica.getUri("profile-recovery-tests"));
  await initializeCatalog();
  await Promise.all(registeredModels.map((m) => m.initialize()));
  app = createApp({
    origin: "http://localhost:4200",
    sessionMiddleware: session({
      secret: "profile-tests-long-session-secret-2026",
      resave: false,
      saveUninitialized: false,
    }),
  });
  for (const [username, role] of [
    ["owner", "admin"],
    ["waiter", "waiter"],
    ["victim", "kitchen"],
  ])
    await UserModel.save({
      username,
      name: username,
      email: username + "@accounts.local",
      password,
      role,
    });
  admin = request.agent(app);
  waiter = request.agent(app);
  victim = request.agent(app);
  for (const [agent, username] of [
    [admin, "owner"],
    [waiter, "waiter"],
    [victim, "victim"],
  ])
    await agent
      .post("/api/auth/login")
      .send({ username, password })
      .expect(200);
});
after(async () => {
  await OwlMongoClose();
  if (replica) await replica.stop();
});

test("el registro HTTP rechaza hashes bcrypt sin crear una cuenta de clave débil", async () => {
  const hash = "$2b$12$" + "a".repeat(53);
  await admin
    .post("/api/admin/accounts")
    .send({ username: "hash-bypass", role: "waiter", password: hash })
    .expect(400);
  assert.equal(await UserModel.countDocuments({ username: "hash-bypass" }), 0);
});
test("perfil propio: autenticación, rol protegido, sin edición de otros usuarios", async () => {
  await request(app)
    .put("/api/admin/me")
    .send({ name: "Attack", username: "attacker" })
    .expect(401);
  const target = await UserModel.getOne({ username: "victim" });
  const result = await waiter
    .put("/api/admin/me")
    .send({
      _id: target.id,
      name: "Waiter updated",
      username: "waiter",
      role: "admin",
      password: "bad",
    })
    .expect(200);
  assert.equal(result.body.role, "waiter");
  assert.equal(result.body.password, undefined);
  assert.equal((await UserModel.getById(target.id)).name, "victim");
  assert.equal((await waiter.get("/api/admin/me")).body.name, "Waiter updated");
  await waiter
    .put("/api/admin/me")
    .send({ name: "Duplicate", username: "owner" })
    .expect(409);
});
test("admin edita otros perfiles y restablece incluso otra cuenta admin", async () => {
  const target = await UserModel.save({
    username: "second-admin",
    name: "Second",
    role: "admin",
    password,
  });
  const id = String(target._id);
  const url = "/api/admin/accounts/" + id;
  const data = { name: "Updated admin", username: "second-updated" };
  const replacement = {
    password: nextPassword,
    passwordConfirmation: nextPassword,
  };
  const other = request.agent(app);
  await other
    .post("/api/auth/login")
    .send({ username: "second-admin", password })
    .expect(200);
  for (const agent of [request(app), waiter]) {
    const status = agent === waiter ? 403 : 401;
    await agent.put(url).send(data).expect(status);
    await agent
      .put(url + "/password")
      .send(replacement)
      .expect(status);
  }
  const updated = await admin
    .put(url)
    .send({ ...data, role: "waiter", password: "ignored", sessionVersion: 999 })
    .expect(200);
  assert.equal(updated.body.role, "admin");
  assert.equal(updated.body.password, undefined);
  await admin
    .put(url)
    .send({ ...data, username: "owner" })
    .expect(409);
  await admin
    .put(url + "/password")
    .send({ ...replacement, passwordConfirmation: "wrong" })
    .expect(400);
  await admin
    .put(url + "/password")
    .send({ password: "short", passwordConfirmation: "short" })
    .expect(400);
  await other.get("/api/admin/me").expect(200);
  await admin
    .put(url + "/password")
    .send(replacement)
    .expect(200);
  await other.get("/api/admin/me").expect(401);
  await admin.get("/api/admin/me").expect(200);
  await request(app)
    .post("/api/auth/login")
    .send({ username: data.username, password })
    .expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ username: data.username, password: nextPassword })
    .expect(200);
  const stored = await UserModel.getById(id);
  assert.equal(stored.sessionVersion, 1);
  assert.equal(await UserModel.compareHash(id, "password", nextPassword), true);
  const own = (await admin.get("/api/admin/me")).body;
  await admin
    .put("/api/admin/accounts/" + own._id + "/password")
    .send(replacement)
    .expect(400);
  await admin.put("/api/admin/accounts/invalid").send(data).expect(400);
  await admin
    .put("/api/admin/accounts/000000000000000000000000")
    .send(data)
    .expect(404);
  await admin
    .put("/api/admin/accounts/000000000000000000000000/password")
    .send(replacement)
    .expect(404);
});

test("restablecimientos admin concurrentes no sobrescriben la misma versión", async (t) => {
  const target = await UserModel.save({
    username: "reset-race",
    name: "Race",
    role: "waiter",
    password,
  });
  const id = String(target._id);
  const original = UserModel.getById.bind(UserModel);
  let reads = 0,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  t.mock.method(UserModel, "getById", async (key, options) => {
    const account = await original(key, options);
    if (String(key) === id) {
      if (++reads === 2) release();
      await gate;
    }
    return account;
  });
  const results = await Promise.all(
    [nextPassword, "Another-secure-password-2026!"].map((value) =>
      admin
        .put("/api/admin/accounts/" + id + "/password")
        .send({ password: value, passwordConfirmation: value }),
    ),
  );
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal((await original(id)).sessionVersion, 1);
});

test("contraseña propia exige contraseña actual y revoca otras sesiones", async () => {
  const other = request.agent(app);
  await other
    .post("/api/auth/login")
    .send({ username: "waiter", password })
    .expect(200);
  await waiter
    .put("/api/admin/me/password")
    .send({
      currentPassword: "wrong",
      password: nextPassword,
      passwordConfirmation: nextPassword,
    })
    .expect(403);
  await waiter
    .put("/api/admin/me/password")
    .send({
      currentPassword: password,
      password: nextPassword,
      passwordConfirmation: nextPassword,
    })
    .expect(200);
  await waiter.get("/api/admin/me").expect(200);
  await other.get("/api/admin/me").expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ username: "waiter", password: nextPassword })
    .expect(200);
});
test("recuperación requiere aprobación admin, mismo navegador y consumo único atómico", async () => {
  const guest = request.agent(app),
    stranger = request.agent(app);
  await guest
    .post("/api/auth/reset/request")
    .send({ username: "victim" })
    .expect(202);
  await guest
    .post("/api/auth/reset/complete")
    .send({ password: nextPassword, passwordConfirmation: nextPassword })
    .expect(403);
  await waiter.get("/api/admin/password-resets").expect(403);
  const pending = (await admin.get("/api/admin/password-resets").expect(200))
    .body;
  const reset = pending.find((r) => r.account.username === "victim");
  assert.ok(reset);
  await waiter
    .patch("/api/admin/password-resets/" + reset._id)
    .send({ state: "approved" })
    .expect(403);
  await admin
    .patch("/api/admin/password-resets/" + reset._id)
    .send({ state: "approved" })
    .expect(200);
  assert.equal(
    (await guest.get("/api/auth/reset/status")).body.state,
    "approved",
  );
  await stranger
    .post("/api/auth/reset/complete")
    .send({ password: nextPassword, passwordConfirmation: nextPassword })
    .expect(403);
  const results = await Promise.all(
    [1, 2].map(() =>
      guest
        .post("/api/auth/reset/complete")
        .send({ password: nextPassword, passwordConfirmation: nextPassword }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 403]);
  await victim.get("/api/admin/me").expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ username: "victim", password: nextPassword })
    .expect(200);
});
test("solicitudes vencidas/rechazadas y usuarios inexistentes no permiten reset", async () => {
  const guest = request.agent(app);
  await guest
    .post("/api/auth/reset/request")
    .send({ username: "owner" })
    .expect(202);
  let pending = (await admin.get("/api/admin/password-resets")).body;
  await admin
    .patch("/api/admin/password-resets/" + pending[0]._id)
    .send({ state: "rejected" })
    .expect(200);
  await guest
    .post("/api/auth/reset/complete")
    .send({ password: nextPassword, passwordConfirmation: nextPassword })
    .expect(403);
  await guest
    .post("/api/auth/reset/request")
    .send({ username: "missing-account" })
    .expect(202);
  assert.equal(
    (await guest.get("/api/auth/reset/status")).body.state,
    "pending",
  );
  assert.equal((await admin.get("/api/admin/password-resets")).body.length, 0);
  await guest
    .post("/api/auth/reset/request")
    .send({ username: "owner" })
    .expect(202);
  await PasswordResetModel.updateMany({}, { $set: { expiresAt: new Date(0) } });
  assert.equal(
    (await guest.get("/api/auth/reset/status")).body.state,
    "expired",
  );
});
test("subtipo de bebida se valida y no se aplica a comidas", async () => {
  const base = {
    name: "Drink",
    category: "drink",
    drinkType: "alcoholic",
    inventory: "unit",
    price: 1000,
    drinkType: "alcoholic",
  };
  const drink = await ProductTypeModel.getOne({ code: "drink" });
  const food = await ProductTypeModel.getOne({ code: "food" });
  assert.equal(productInput(base, drink).drinkType, "alcoholic");
  assert.equal(
    productInput({ ...base, drinkType: "non_alcoholic" }, drink).drinkType,
    "non_alcoholic",
  );
  for (const drinkType of [undefined, "", "invalid", null])
    assert.throws(() => productInput({ ...base, drinkType }, drink));
  assert.equal(
    productInput({ ...base, category: "food", inventory: "none" }, food)
      .drinkType,
    "",
  );
  const created = await ProductModel.save(productInput(base, drink));
  assert.equal(created.drinkType, "alcoholic");
});

test("la API exige subcategoría al crear y editar bebidas", async () => {
  const data = {
    name: "Sin clasificar",
    category: "drink",
    inventory: "unit",
    price: 1000,
  };
  for (const drinkType of [undefined, "", "other"])
    await admin
      .post("/api/admin/products")
      .send({ ...data, drinkType })
      .expect(400);
  const created = (
    await admin
      .post("/api/admin/products")
      .send({ ...data, drinkType: "non_alcoholic" })
      .expect(201)
  ).body;
  await admin
    .put("/api/admin/products/" + created._id)
    .send({ ...data, drinkType: "" })
    .expect(400);
  const updated = (
    await admin
      .put("/api/admin/products/" + created._id)
      .send({ ...data, drinkType: "alcoholic" })
      .expect(200)
  ).body;
  assert.equal(updated.drinkType, "alcoholic");
});
