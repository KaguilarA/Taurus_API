import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import session from "express-session";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import {
  OwlMongoConnect,
  OwlMongoClose,
  OwlCollection,
  OwlObjectId,
} from "owl-expressjs-utils";
import {
  ProductModel,
  ProductStockModel,
  ProductTypeModel,
  OrderModel,
  StockMovementModel,
  UserModel,
  BusinessModel,
  registeredModels,
} from "../../models/models.js";
import { migrateCatalog } from "../../db/migrate-catalog.js";
import { createApp } from "../../app.js";
import { hasStaffOrders } from "../../services/order-activity.js";

let replica, app, admin;
const collections = [
  "products",
  "productstocks",
  "producttypes",
  "applicationmigrations",
  "users",
  "businesses",
  "orders",
  "stockmovements",
  "carts",
  "tables",
];
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await OwlMongoConnect(replica.getUri("catalog-tests"), { autoIndex: false });
});
beforeEach(async () => {
  for (const name of collections) await OwlCollection(name).deleteMany({});
});
after(async () => {
  await OwlMongoClose();
  await replica?.stop();
});

test("migra saldos, mínimos y tipos existentes; conserva fuentes e historial y no vuelve a copiar saldos", async () => {
  const drink = { _id: new OwlObjectId(), name: "Bebidas" };
  await OwlCollection("producttypes").insertOne(drink);
  const bottle = {
    _id: new OwlObjectId(),
    name: "Ron",
    category: "drink",
    type: [drink._id],
    inventory: "ml",
    stock: 1500,
    minimum: 300,
    bottleMl: 750,
    price: 1000,
    prices: { shot: 1000, small: 2000, large: 3000 },
  };
  const snack = {
    _id: new OwlObjectId(),
    name: "Snack",
    category: "snack",
    inventory: "none",
    stock: 0,
    minimum: 0,
    price: 800,
  };
  const food = {
    _id: new OwlObjectId(),
    name: "Plato",
    category: "food",
    inventory: "none",
    stock: 0,
    price: 1000,
  };
  await OwlCollection("products").insertMany([bottle, snack, food]);
  const stockId = new OwlObjectId();
  await OwlCollection("productstocks").insertOne({
    _id: stockId,
    owner: bottle._id,
    stock: 1500,
  });
  await OwlCollection("productstocks").createIndex(
    { stock: 1 },
    { unique: true },
  );
  const order = {
    _id: new OwlObjectId(),
    requestId: "historical",
    items: [{ productId: String(bottle._id), category: "drink", consumed: 30 }],
    status: "paid",
    total: 1000,
  };
  await OwlCollection("orders").insertOne(order);
  await assert.rejects(() => migrateCatalog(), /MAINTENANCE_MODE/);
  await migrateCatalog({ maintenance: true });
  const stored = await OwlCollection("products").findOne({ _id: bottle._id });
  assert.equal(stored.category, "liquor");
  assert.equal(stored.legacyCatalog.category, "drink");
  assert.equal(stored.stock, undefined);
  assert.equal(stored.minimum, undefined);
  assert.equal(stored.type, undefined);
  assert.equal(stored.legacyCatalog.stock, 1500);
  assert.equal(stored.legacyCatalog.minimum, 300);
  assert.deepEqual(stored.legacyCatalog.type, [drink._id]);
  assert.deepEqual(stored.prices, bottle.prices);
  assert.equal(
    (await ProductTypeModel.getById(stored.productType)).code,
    "liquor",
  );
  assert.equal(
    (await ProductStockModel.getOne({ owner: bottle._id })).id,
    String(stockId),
  );
  assert.equal(
    (await ProductStockModel.getOne({ owner: bottle._id })).minimum,
    300,
  );
  assert.equal((await ProductStockModel.getOne({ owner: snack._id })).stock, 0);
  assert.equal(await ProductStockModel.exists({ owner: food._id }), false);
  assert.equal(
    (await ProductTypeModel.getOne({ code: "drink" })).id,
    String(drink._id),
  );
  assert.deepEqual(
    await OwlCollection("orders").findOne({ _id: order._id }),
    order,
  );
  await ProductStockModel.updateWhere(
    { owner: bottle._id },
    { $inc: { stock: -30 } },
  );
  await migrateCatalog();
  assert.equal(
    (await ProductStockModel.getOne({ owner: bottle._id })).stock,
    1470,
  );
  assert.equal(await ProductStockModel.countDocuments(), 2);
  const indexes = await OwlCollection("productstocks").listIndexes().toArray();
  assert.ok(!indexes.some((i) => i.unique && i.key.stock));
  assert.ok(indexes.some((i) => i.unique && i.key.owner));
});

test("un saldo contradictorio detiene la migración completa sin alterar fuentes ni índices", async () => {
  const product = {
    _id: new OwlObjectId(),
    name: "Bebida",
    category: "drink",
    inventory: "unit",
    stock: 10,
    price: 1000,
  };
  await OwlCollection("products").insertOne(product);
  await OwlCollection("productstocks").insertOne({
    owner: product._id,
    stock: 11,
  });
  await OwlCollection("productstocks").createIndex(
    { stock: 1 },
    { unique: true },
  );
  await assert.rejects(
    () => migrateCatalog({ maintenance: true }),
    /saldo.*difiere/,
  );
  assert.deepEqual(
    await OwlCollection("products").findOne({ _id: product._id }),
    product,
  );
  assert.equal(await ProductTypeModel.countDocuments(), 0);
  assert.equal(
    await OwlCollection("applicationmigrations").countDocuments(),
    0,
  );
  assert.ok(
    (await OwlCollection("productstocks").listIndexes().toArray()).some(
      (i) => i.unique && i.key.stock,
    ),
  );
  await OwlCollection("productstocks").dropIndex("stock_1");
});

test("inventarios duplicados y referencias múltiples se rechazan sin modificar los registros", async () => {
  const product = {
    _id: new OwlObjectId(),
    name: "Duplicado",
    category: "snack",
    inventory: "unit",
    price: 1000,
  };
  await OwlCollection("products").insertOne(product);
  // Even a legacy string owner and its ObjectId equivalent refer to the same product.
  await OwlCollection("productstocks").insertMany([
    { owner: product._id, stock: 4 },
    { owner: String(product._id), stock: 5 },
  ]);
  await assert.rejects(
    () => migrateCatalog({ maintenance: true }),
    /varios registros/,
  );
  assert.deepEqual(
    await OwlCollection("products").findOne({ _id: product._id }),
    product,
  );
  assert.equal(await ProductStockModel.countDocuments(), 2);
  await OwlCollection("productstocks").deleteMany({});
  await OwlCollection("products").updateOne(
    { _id: product._id },
    { $set: { type: [new OwlObjectId(), new OwlObjectId()] } },
  );
  await assert.rejects(
    () => migrateCatalog({ maintenance: true }),
    /varios tipos/,
  );
  assert.equal(await ProductTypeModel.countDocuments(), 0);
  assert.equal(
    await OwlCollection("applicationmigrations").countDocuments(),
    0,
  );
});

test("archiva duplicados de una instalación v1 sin reemplazar el saldo canónico actualizado", async () => {
  await migrateCatalog();
  await OwlCollection("applicationmigrations").deleteOne({
    _id: "product-catalog-source-archive-v2",
  });
  const type = await ProductTypeModel.getOne({ code: "drink" });
  const product = {
    _id: new OwlObjectId(),
    name: "Migrado",
    category: "drink",
    productType: type._id,
    inventory: "unit",
    stock: 17,
    minimum: 3,
    price: 1000,
    legacyCatalog: { stock: 17, minimum: 3 },
  };
  await OwlCollection("products").insertOne(product);
  await ProductStockModel.save({
    owner: product._id,
    unit: "unit",
    stock: 12,
    minimum: 3,
  });
  await assert.rejects(() => migrateCatalog(), /MAINTENANCE_MODE/);
  await migrateCatalog({ maintenance: true });
  const stored = await OwlCollection("products").findOne({ _id: product._id });
  assert.equal(stored.stock, undefined);
  assert.equal(stored.minimum, undefined);
  assert.equal(stored.legacyCatalog.stock, 17);
  assert.equal(
    (await ProductStockModel.getOne({ owner: product._id })).stock,
    12,
  );
  await migrateCatalog();
  assert.equal(
    (await ProductStockModel.getOne({ owner: product._id })).stock,
    12,
  );
});

async function setupApi() {
  await migrateCatalog();
  await Promise.all(registeredModels.map((m) => m.initialize()));
  await UserModel.save({
    username: "owner",
    role: "admin",
    password: "Catalog-tests-password-2026!",
  });
  await BusinessModel.save({
    key: "main",
    name: "Catálogo",
    servings: { shot: 30, small: 60, large: 90 },
  });
  app = createApp({
    origin: "http://localhost:4200",
    sessionMiddleware: session({
      secret: "catalog-session-secret-over-32-characters",
      resave: false,
      saveUninitialized: false,
    }),
  });
  admin = request.agent(app);
  await admin
    .post("/api/auth/login")
    .send({ username: "owner", password: "Catalog-tests-password-2026!" })
    .expect(200);
}
const liquorInput = {
  name: "Botella 750",
  category: "liquor",
  inventory: "ml",
  bottleLiters: 0.75,
  price: 900,
  prices: { shot: 900, small: 1600, large: 2200 },
  minimum: 100,
};

test("botellas aceptan litros, descuentan cada medida y anular devuelve el saldo una sola vez", async () => {
  await setupApi();
  const product = (
    await admin
      .post("/api/admin/products")
      .send({ ...liquorInput, stock: 99999 })
      .expect(201)
  ).body;
  assert.equal(product.bottleMl, 750);
  assert.equal(product.bottleLiters, 0.75);
  assert.equal(product.stock, 0);
  assert.equal(
    (
      await OwlCollection("products").findOne({
        _id: new OwlObjectId(product._id),
      })
    ).stock,
    undefined,
  );
  await admin
    .post(`/api/admin/products/${product._id}/stock`)
    .send({ delta: 1500, reason: "Dos botellas de 750 ml" })
    .expect(200);
  const payload = {
    requestId: "measures",
    items: [
      { productId: product._id, serving: "shot", quantity: 2 },
      { productId: product._id, serving: "small", quantity: 1 },
      { productId: product._id, serving: "large", quantity: 1 },
    ],
  };
  const sale = (await admin.post("/api/admin/sales").send(payload).expect(201))
    .body;
  assert.equal(sale.total, 5600);
  assert.equal(
    (await ProductStockModel.getOne({ owner: product._id })).stock,
    1290,
  );
  await admin.post("/api/admin/sales").send(payload).expect(201);
  assert.equal(
    (await ProductStockModel.getOne({ owner: product._id })).stock,
    1290,
  );
  await admin
    .post(`/api/admin/sales/${sale._id}/void`)
    .send({ reason: "Duplicado" })
    .expect(200);
  await admin
    .post(`/api/admin/sales/${sale._id}/void`)
    .send({ reason: "Duplicado" })
    .expect(409);
  assert.equal(
    (await ProductStockModel.getOne({ owner: product._id })).stock,
    1500,
  );
  assert.equal(
    await StockMovementModel.countDocuments({ saleId: sale._id }),
    6,
  );
  for (const bottleLiters of [0, -1, "0.75", 0.0001, 0.7505])
    await admin
      .post("/api/admin/products")
      .send({ ...liquorInput, bottleLiters })
      .expect(400);
  const state = (await admin.get("/api/admin/state").expect(200)).body;
  assert.equal(state.products.find((p) => p._id === product._id).stock, 1500);
  await request(app)
    .get("/api/public/menu?category=liquor")
    .expect(200)
    .then((r) => {
      assert.equal(r.body.items.length, 1);
      assert.equal(r.body.items[0].stock, undefined);
    });
});

test("snacks consumen unidades, no permiten medidas y saldos iguales pertenecen a productos distintos", async () => {
  await setupApi();
  const create = () =>
    admin
      .post("/api/admin/products")
      .send({ name: "Snack", category: "snack", inventory: "unit", price: 500 })
      .expect(201);
  const first = (await create()).body,
    second = (await create()).body;
  assert.equal(await ProductStockModel.countDocuments({ stock: 0 }), 2);
  await assert.rejects(
    () => ProductStockModel.save({ owner: first._id, unit: "unit", stock: 3 }),
    (error) => error.code === 11000,
  );
  await admin
    .post(`/api/admin/products/${first._id}/stock`)
    .send({ delta: 1, reason: "Última unidad" })
    .expect(200);
  await admin
    .post("/api/admin/sales")
    .send({
      requestId: "bad-measure",
      items: [{ productId: first._id, serving: "shot", quantity: 1 }],
    })
    .expect(400);
  const responses = await Promise.all(
    ["a", "b"].map((requestId) =>
      admin
        .post("/api/admin/sales")
        .send({ requestId, items: [{ productId: first._id, quantity: 1 }] }),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await ProductStockModel.getOne({ owner: first._id })).stock, 0);
  assert.equal(
    (await ProductStockModel.getOne({ owner: second._id })).stock,
    0,
  );
  await admin
    .post("/api/admin/products")
    .send({ ...liquorInput, category: "drink", drinkType: "alcoholic" })
    .expect(400);
  await admin
    .post("/api/admin/product-types")
    .send({ code: "other-liquor", name: "Otro", inventoryModes: ["ml"] })
    .expect(400);
});

test("tipos dinámicos controlan filtros, cocina, archivo y permisos sin cambiar el código", async () => {
  await setupApi();
  await request(app).post("/api/admin/product-types").send({}).expect(401);
  const type = (
    await admin
      .post("/api/admin/product-types")
      .send({
        code: "dessert",
        name: "Postres",
        inventoryModes: ["unit"],
        kitchen: true,
      })
      .expect(201)
  ).body;
  const product = (
    await admin
      .post("/api/admin/products")
      .send({
        name: "Postre",
        productType: type._id,
        inventory: "unit",
        price: 1000,
      })
      .expect(201)
  ).body;
  assert.equal(product.category, "dessert");
  await admin
    .post(`/api/admin/products/${product._id}/stock`)
    .send({ delta: 2, reason: "Preparación" })
    .expect(200);
  await admin
    .put(`/api/admin/product-types/${type._id}`)
    .send({ ...type, inventoryModes: ["none"] })
    .expect(409);
  await request(app)
    .get("/api/public/product-types")
    .expect(200)
    .then((r) => assert.ok(r.body.some((t) => t.code === "dessert")));
  await request(app)
    .get("/api/public/menu?category=dessert")
    .expect(200)
    .then((r) => assert.equal(r.body.total, 1));
  const table = (
    await admin.post("/api/admin/tables").send({ name: "Postres" }).expect(201)
  ).body;
  const bill = (
    await request(app)
      .post(`/api/public/tables/${table.token}/join`)
      .expect(200)
  ).body;
  const order = (
    await request(app)
      .post(`/api/public/bills/${bill.token}/orders`)
      .send({
        requestId: "dessert",
        items: [{ productId: product._id, quantity: 1 }],
      })
      .expect(201)
  ).body;
  assert.equal(order.orderStatus, "preparing");
  assert.equal(await hasStaffOrders("kitchen"), true);
  await admin
    .put(`/api/admin/product-types/${type._id}`)
    .send({ ...type, kitchen: false })
    .expect(200);
  assert.equal((await OrderModel.getById(order._id)).items[0].kitchen, true);
  await admin
    .patch(`/api/admin/orders/${order._id}`)
    .send({ status: "ready", itemIndex: 0 })
    .expect(200);
  await admin
    .put(`/api/admin/product-types/${type._id}`)
    .send({ ...type, active: false })
    .expect(200);
  await request(app).get(`/api/public/menu/${product._id}`).expect(404);
  await admin
    .post("/api/admin/sales")
    .send({
      requestId: "inactive-type",
      items: [{ productId: product._id, quantity: 1 }],
    })
    .expect(409);
  assert.equal(
    (await ProductStockModel.getOne({ owner: product._id })).stock,
    1,
  );
  await request(app)
    .get("/api/public/menu")
    .expect(200)
    .then((r) => assert.equal(r.body.total, 0));
});
