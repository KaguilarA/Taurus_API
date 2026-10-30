import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import session from "express-session";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { OwlMongoConnect, OwlMongoClose } from "owl-expressjs-utils";
import {
  ProductModel,
  BusinessModel,
  UserModel,
  registeredModels,
} from "../../models/models.js";
import { createApp } from "../../app.js";
let replica, app, admin, waiter, products, business;
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await OwlMongoConnect(replica.getUri("public-menu-pagination"));
  await Promise.all(registeredModels.map((model) => model.initialize()));
  business = await BusinessModel.save({
    key: "main",
    name: "Pagination test",
    currency: "CRC",
    accent: "#F5A623",
    servings: { large: 90, small: 60, shot: 30 },
  });
  const data = Array.from({ length: 18 }, (_, index) => ({
    name: "Bebida " + String(index + 1).padStart(2, "0"),
    description: "Refresco de la casa",
    category: "drink",
    drinkType: index % 2 ? "alcoholic" : "non_alcoholic",
    inventory: "unit",
    price: 1500,
    active: index !== 17,
    stock: 25,
    minimum: 4,
  }));
  data.push(
    ...Array.from({ length: 4 }, (_, index) => ({
      name: "Comida " + index,
      description: "Plato preparado",
      category: "food",
      inventory: "none",
      price: 3000,
      active: true,
    })),
    {
      name: "Plátanos crujientes",
      description: "Botana",
      category: "snack",
      inventory: "none",
      price: 800,
      active: true,
    },
  );
  products = await ProductModel.saveMany(data);
  for (const role of ["admin", "waiter"])
    await UserModel.save({
      username: role,
      name: role,
      role,
      password: "Menu-password-2026!",
    });
  app = createApp({
    origin: "http://localhost:4200",
    sessionMiddleware: session({
      secret: "menu-tests-session-secret-over-32-characters",
      resave: false,
      saveUninitialized: false,
    }),
  });
  admin = request.agent(app);
  waiter = request.agent(app);
  for (const [agent, username] of [
    [admin, "admin"],
    [waiter, "waiter"],
  ])
    await agent
      .post("/api/auth/login")
      .send({ username, password: "Menu-password-2026!" })
      .expect(200);
});
after(async () => {
  await OwlMongoClose();
  await replica?.stop();
});
test("el backend pagina con orden estable, totales reales y sin exponer inventario", async () => {
  const first = (
    await request(app).get("/api/public/menu?page=1&pageSize=6").expect(200)
  ).body;
  const second = (
    await request(app).get("/api/public/menu?page=2&pageSize=6").expect(200)
  ).body;
  assert.equal(first.items.length, 6);
  assert.equal(first.total, 22);
  assert.equal(first.pageCount, 4);
  assert.equal(second.page, 2);
  assert.equal(
    new Set([...first.items, ...second.items].map((p) => p._id)).size,
    12,
  );
  assert.equal(first.items[0].stock, undefined);
  assert.equal(first.items[0].minimum, undefined);
  const repeated = (
    await request(app).get("/api/public/menu?page=1&pageSize=6")
  ).body;
  assert.deepEqual(
    repeated.items.map((p) => p._id),
    first.items.map((p) => p._id),
  );
  const last = (await request(app).get("/api/public/menu?page=999&pageSize=6"))
    .body;
  assert.equal(last.page, 4);
  assert.equal(last.items.length, 4);
  const bootstrap = (await request(app).get("/api/public")).body;
  assert.equal(bootstrap.menu.total, 22);
  assert.equal(bootstrap.products.length, 9);
});
test("buscador, acentos, categoría y subcategoría se aplican antes de paginar", async () => {
  const filtered = (
    await request(app).get(
      "/api/public/menu?category=drink&drinkType=alcoholic&q=casa&pageSize=3",
    )
  ).body;
  assert.equal(filtered.total, 8);
  assert.equal(filtered.items.length, 3);
  assert.ok(
    filtered.items.every(
      (p) => p.category === "drink" && p.drinkType === "alcoholic",
    ),
  );
  const accent = (await request(app).get("/api/public/menu?q=platano")).body;
  assert.equal(accent.total, 1);
  assert.equal(accent.items[0].name, "Plátanos crujientes");
  const literal = (
    await request(app).get("/api/public/menu?q=" + encodeURIComponent(".*"))
  ).body;
  assert.equal(literal.total, 0);
  assert.equal(literal.page, 1);
  assert.equal(literal.pageCount, 0);
});
test("valida parámetros y los detalles solo muestran productos activos", async () => {
  for (const query of [
    "page=0",
    "page=-1",
    "page=1.5",
    "pageSize=999",
    "category=invalid",
    "drinkType=invalid",
    "category=food&drinkType=alcoholic",
    "q=" + "a".repeat(101),
    "page=1&page=2",
  ])
    await request(app)
      .get("/api/public/menu?" + query)
      .expect(400);
  const detail = (
    await request(app)
      .get("/api/public/menu/" + products[0]._id)
      .expect(200)
  ).body;
  assert.equal(detail.name, products[0].name);
  assert.equal(detail.description, "Refresco de la casa");
  assert.equal(detail.stock, undefined);
  await request(app)
    .get("/api/public/menu/" + products[17]._id)
    .expect(404);
  await request(app).get("/api/public/menu/bad-id").expect(400);
});
test("solo el admin configura visibilidad y la preferencia persiste sin alterar precios", async () => {
  const settings = business.toJSON();
  assert.equal(settings.showMenuPrices, true);
  await request(app)
    .put("/api/admin/settings")
    .send({ ...settings, showMenuPrices: false })
    .expect(401);
  await waiter
    .put("/api/admin/settings")
    .send({ ...settings, showMenuPrices: false })
    .expect(403);
  await admin
    .put("/api/admin/settings")
    .send({ ...settings, showMenuPrices: false })
    .expect(200);
  assert.equal(
    (await request(app).get("/api/public")).body.settings.showMenuPrices,
    false,
  );
  await admin
    .put("/api/admin/settings")
    .send({ ...settings, showMenuPrices: "false" })
    .expect(400);
  const { showMenuPrices, ...olderClient } = settings;
  await admin.put("/api/admin/settings").send(olderClient).expect(200);
  assert.equal(
    (await BusinessModel.getOne({ key: "main" })).showMenuPrices,
    false,
  );
  assert.equal((await ProductModel.getById(products[0]._id)).price, 1500);
});
