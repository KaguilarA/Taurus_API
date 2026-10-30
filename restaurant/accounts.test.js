import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import session from "express-session";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "./app.js";
import { Accounts, Product } from "./models.js";
import { productInput } from "./domain.js";
let replica, app, admin, waiter, victim;
const password = "Account-tests-password-2026!";
const nextPassword = "Updated-account-password-2026!";
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replica.getUri("profile-recovery-tests"));
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
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
    await Accounts.save({
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
  await mongoose.disconnect();
  if (replica) await replica.stop();
});
test("perfil propio: autenticación, rol protegido, sin edición de otros usuarios", async () => {
  await request(app)
    .put("/api/admin/me")
    .send({ name: "Attack", username: "attacker" })
    .expect(401);
  const target = await mongoose
    .model("RestaurantAccount")
    .findOne({ username: "victim" });
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
  assert.equal(
    (await mongoose.model("RestaurantAccount").findById(target.id)).name,
    "victim",
  );
  assert.equal((await waiter.get("/api/admin/me")).body.name, "Waiter updated");
  await waiter
    .put("/api/admin/me")
    .send({ name: "Duplicate", username: "owner" })
    .expect(409);
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
  await mongoose
    .model("RestaurantPasswordReset")
    .updateMany({}, { $set: { expiresAt: new Date(0) } });
  assert.equal(
    (await guest.get("/api/auth/reset/status")).body.state,
    "expired",
  );
});
test("subtipo de bebida se valida y no se aplica a comidas", async () => {
  const base = {
    name: "Drink",
    category: "drink",
    inventory: "unit",
    price: 1000,
    drinkType: "alcoholic",
  };
  assert.equal(productInput(base).drinkType, "alcoholic");
  assert.equal(
    productInput({ ...base, drinkType: "non_alcoholic" }).drinkType,
    "non_alcoholic",
  );
  assert.throws(() => productInput({ ...base, drinkType: "invalid" }));
  assert.equal(
    productInput({ ...base, category: "food", inventory: "none" }).drinkType,
    "",
  );
  const created = await Product.create(productInput(base));
  assert.equal(created.drinkType, "alcoholic");
});
