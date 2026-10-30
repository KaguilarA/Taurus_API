import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import session from "express-session";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "./app.js";
import { seed } from "../test/fixtures/seed.js";
import { Product, Sale, Movement, Accounts } from "./models.js";

let replica, app, admin, rum, food, beer;
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replica.getUri("tests"));
  await seed({
    email: "admin@test.local",
    password: "Test-password-2026!",
    demo: true,
  });
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  app = createApp({
    origin: "http://localhost:4200",
    sessionMiddleware: session({
      secret: "test-session-secret-with-more-than-32-chars",
      resave: false,
      saveUninitialized: false,
    }),
  });
  admin = request.agent(app);
  await admin
    .post("/api/auth/login")
    .send({ email: "admin@test.local", password: "Test-password-2026!" })
    .expect(200);
  rum = await Product.findOne({ name: "Ron de la casa" });
  food = await Product.findOne({ name: "Burger de la casa" });
  beer = await Product.findOne({ name: "Cerveza artesanal" });
});
after(async () => {
  await mongoose.disconnect();
  if (replica) await replica.stop();
});

test("OWL protege contraseñas y endpoints administrativos", async () => {
  await request(app).get("/api/admin/state").expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@test.local", password: "wrong" })
    .expect(401);
  const account = await Accounts.getOne({ email: "admin@test.local" });
  assert.equal(account.toJSON().password, undefined);
  assert.equal(
    await Accounts.compareHash(
      String(account._id),
      "password",
      "Test-password-2026!",
    ),
    true,
  );
});
test("carta pública no expone saldo, cuentas ni ventas", async () => {
  const { body } = await request(app).get("/api/public").expect(200);
  assert.equal(body.products.length, 7);
  assert.ok(
    body.products.every(
      (p) => p.stock === undefined && p.minimum === undefined,
    ),
  );
  assert.equal(body.sales, undefined);
  assert.equal(body.promotions.length, 1);
});
test("venta mixta descuenta ml y unidades; comida no consume inventario", async () => {
  const { body } = await admin
    .post("/api/admin/sales")
    .send({
      requestId: "mixed",
      label: "Mesa 1",
      items: [
        { productId: rum.id, serving: "large", quantity: 2 },
        { productId: rum.id, serving: "small", quantity: 1 },
        { productId: food.id, quantity: 2 },
        { productId: beer.id, quantity: 3 },
      ],
    })
    .expect(201);
  assert.equal(body.total, 9000 + 3200 + 13000 + 8400);
  assert.equal((await Product.findById(rum.id)).stock, 2760);
  assert.equal((await Product.findById(beer.id)).stock, 21);
  assert.equal((await Product.findById(food.id)).stock, 0);
  assert.equal(await Movement.countDocuments({ saleId: body._id }), 3);
});
test("reintentar una venta no vuelve a cobrar ni descontar", async () => {
  const before = await Product.findById(rum.id);
  await admin
    .post("/api/admin/sales")
    .send({
      requestId: "mixed",
      items: [{ productId: rum.id, serving: "shot", quantity: 1 }],
    })
    .expect(201);
  assert.equal((await Product.findById(rum.id)).stock, before.stock);
  assert.equal(await Sale.countDocuments({ requestId: "mixed" }), 1);
});
test("falta de stock revierte la venta completa y sus movimientos", async () => {
  const before = (await Product.findById(rum.id)).stock;
  await admin
    .post("/api/admin/sales")
    .send({
      requestId: "rollback",
      items: [
        { productId: rum.id, serving: "shot", quantity: 1 },
        { productId: beer.id, quantity: 1000 },
      ],
    })
    .expect(409);
  assert.equal((await Product.findById(rum.id)).stock, before);
  assert.equal(await Sale.countDocuments({ requestId: "rollback" }), 0);
});
test("ventas concurrentes nunca dejan saldo negativo", async () => {
  const scarce = await Product.create({
    name: "Último shot",
    category: "drink",
    inventory: "ml",
    price: 1000,
    prices: { large: 3000, small: 2000, shot: 1000 },
    stock: 30,
  });
  const results = await Promise.all(
    ["race-a", "race-b"].map((requestId) =>
      admin.post("/api/admin/sales").send({
        requestId,
        items: [{ productId: scarce.id, serving: "shot", quantity: 1 }],
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await Product.findById(scarce.id)).stock, 0);
});
test("cantidad, medida y categoría inválidas son rechazadas", async () => {
  for (const quantity of [0, -1, 0.5, "1"])
    await admin
      .post("/api/admin/sales")
      .send({
        requestId: `bad-${quantity}`,
        items: [{ productId: rum.id, serving: "shot", quantity }],
      })
      .expect(400);
  await admin
    .post("/api/admin/sales")
    .send({
      requestId: "bad-size",
      items: [{ productId: rum.id, serving: "unknown", quantity: 1 }],
    })
    .expect(400);
  await admin
    .post("/api/admin/products")
    .send({ name: "Food", category: "food", inventory: "ml", price: 200 })
    .expect(400);
  await admin
    .post("/api/admin/products")
    .send({ name: "Bebida", category: "drink", inventory: "none", price: 200 })
    .expect(400);
});
test("reposiciones y mermas registran saldo; no permiten saldo negativo", async () => {
  const before = (await Product.findById(rum.id)).stock;
  await admin
    .post(`/api/admin/products/${rum.id}/stock`)
    .send({ delta: 1000, reason: "Compra de botella" })
    .expect(200);
  await admin
    .post(`/api/admin/products/${rum.id}/stock`)
    .send({ delta: -60, reason: "Merma" })
    .expect(200);
  assert.equal((await Product.findById(rum.id)).stock, before + 940);
  await admin
    .post(`/api/admin/products/${rum.id}/stock`)
    .send({ delta: -100000, reason: "Error" })
    .expect(409);
  await admin
    .post(`/api/admin/products/${food.id}/stock`)
    .send({ delta: 1, reason: "Error" })
    .expect(409);
});
test("anulación devuelve inventario una sola vez y sale del reporte", async () => {
  const sale = await Sale.findOne({ requestId: "mixed" });
  const before = (await Product.findById(rum.id)).stock;
  await admin
    .post(`/api/admin/sales/${sale.id}/void`)
    .send({ reason: "Pedido duplicado" })
    .expect(200);
  await admin
    .post(`/api/admin/sales/${sale.id}/void`)
    .send({ reason: "Otra vez" })
    .expect(409);
  assert.equal((await Product.findById(rum.id)).stock, before + 240);
  const { body } = await admin.get("/api/admin/reports").expect(200);
  assert.equal(body.count, 1);
  assert.equal(body.revenue, 1000);
  assert.equal(body.ranking.length, 1);
  assert.equal(body.ranking[0].name, "Último shot");
});
test("medidas configurables afectan próximas ventas y preservan las anteriores", async () => {
  const { body } = await admin.get("/api/admin/state").expect(200);
  body.settings.servings.shot = 25;
  await admin.put("/api/admin/settings").send(body.settings).expect(200);
  const before = (await Product.findById(rum.id)).stock;
  await admin
    .post("/api/admin/sales")
    .send({
      requestId: "shot-25",
      items: [{ productId: rum.id, serving: "shot", quantity: 2 }],
    })
    .expect(201);
  assert.equal((await Product.findById(rum.id)).stock, before - 50);
  const old = await Sale.findOne({ requestId: "mixed" });
  assert.equal(old.items[0].consumed, 180);
  assert.equal(old.items[0].unitPrice, 4500);
});
test("ventas solo de comida se registran sin movimientos de inventario", async () => {
  const { body } = await admin
    .post("/api/admin/sales")
    .send({
      requestId: "food-only",
      items: [{ productId: food.id, quantity: 2 }],
    })
    .expect(201);
  assert.equal(body.total, 13000);
  assert.equal(await Movement.countDocuments({ saleId: body._id }), 0);
});
test("confirmaciones simultáneas de la misma orden descuentan una vez", async () => {
  const before = (await Product.findById(rum.id)).stock;
  const payload = {
    requestId: "same-order-concurrent",
    items: [{ productId: rum.id, serving: "shot", quantity: 1 }],
  };
  const responses = await Promise.all([
    admin.post("/api/admin/sales").send(payload),
    admin.post("/api/admin/sales").send(payload),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [201, 201],
  );
  assert.equal(responses[0].body._id, responses[1].body._id);
  assert.equal((await Product.findById(rum.id)).stock, before - 25);
});
test("promociones futuras, vencidas y pausadas no se publican", async () => {
  for (const [starts, ends, active] of [
    ["2099-01-01", "2100-01-01", true],
    ["2000-01-01", "2001-01-01", true],
    ["2000-01-01", "2100-01-01", false],
  ]) {
    await admin
      .post("/api/admin/promotions")
      .send({
        title: "No visible",
        starts,
        ends,
        active,
        image: "",
        description: "",
      })
      .expect(201);
  }
  const { body } = await request(app).get("/api/public").expect(200);
  assert.equal(body.promotions.length, 1);
  await admin
    .post("/api/admin/promotions")
    .send({ title: "Error", starts: "2030-01-01", ends: "2020-01-01" })
    .expect(400);
});
test("archivado conserva historial y bloquea ventas nuevas; reportes respetan fechas", async () => {
  await admin
    .put(`/api/admin/products/${food.id}`)
    .send({ ...food.toObject(), active: false })
    .expect(200);
  await admin
    .post("/api/admin/sales")
    .send({
      requestId: "archived",
      items: [{ productId: food.id, quantity: 1 }],
    })
    .expect(409);
  const menu = await request(app).get("/api/public").expect(200);
  assert.ok(!menu.body.products.some((p) => p._id === food.id));
  const history = await Sale.findOne({ requestId: "food-only" });
  assert.equal(history.items[0].name, food.name);
  const { body } = await admin
    .get("/api/admin/reports?from=2000-01-01&to=2001-01-01")
    .expect(200);
  assert.equal(body.count, 0);
  assert.equal(body.revenue, 0);
  assert.deepEqual(body.ranking, []);
});
test("origen ajeno no puede modificar datos y logout invalida sesión", async () => {
  await admin
    .post("/api/admin/products")
    .set("Origin", "https://evil.example")
    .send({})
    .expect(403);
  await admin.get("/api/admin/reports?from=bad").expect(400);
  await admin.post("/api/auth/logout").expect(200);
  await admin.get("/api/admin/state").expect(401);
});
