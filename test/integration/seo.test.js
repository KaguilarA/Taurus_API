import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import session from "express-session";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { OwlMongoConnect, OwlMongoClose } from "owl-expressjs-utils";
import { createApp } from "../../app.js";
import {
  BusinessModel,
  UserModel,
  ProductModel,
  ProductTypeModel,
  registeredModels,
} from "../../models/models.js";
import { initializeCatalog } from "../fixtures/catalog.js";
import { seoDefaults, seoInput } from "../../services/seo.js";

let replica, app, admin, waiter, product;
const origin = "https://restaurant.example";
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await OwlMongoConnect(replica.getUri("seo-tests"));
  await initializeCatalog();
  await Promise.all(registeredModels.map((model) => model.initialize()));
  await BusinessModel.save({
    key: "main",
    name: "Original Restaurant",
    description: "Existing description",
    currency: "CRC",
    accent: "#f5a623",
    servings: { large: 90, small: 60, shot: 30 },
  });
  const type = await ProductTypeModel.getOne({ code: "food" }, { lean: true });
  product = await ProductModel.save({
    name: "Dinner",
    description: "Public dish",
    category: "food",
    productType: type._id,
    inventory: "none",
    active: true,
    price: 1500,
    purchasePrice: 700,
  });
  app = createApp({
    origin,
    sessionMiddleware: session({
      secret: "seo-tests-session-secret-long-enough",
      resave: false,
      saveUninitialized: false,
    }),
  });
  for (const role of ["admin", "waiter"]) {
    await UserModel.save({
      username: role,
      email: role + "@tests.local",
      password: "Seo-test-password-2026!",
      role,
    });
  }
  admin = request.agent(app);
  waiter = request.agent(app);
  for (const [agent, username] of [
    [admin, "admin"],
    [waiter, "waiter"],
  ])
    await agent
      .post("/api/auth/login")
      .send({ username, password: "Seo-test-password-2026!" })
      .expect(200);
});
after(async () => {
  await OwlMongoClose();
  await replica?.stop();
});

test("existing business data supplies SEO defaults without a migration", async () => {
  const response = await request(app).get("/api/seo").expect(200);
  assert.equal(response.body.title, "Original Restaurant");
  assert.equal(response.body.description, "Existing description");
  assert.equal(response.body.canonical, origin + "/");
  assert.equal(response.body.indexable, true);
  assert.equal(response.headers["cache-control"], "no-store");
});

test("only administrators can edit or read the SEO administration API", async () => {
  await request(app).get("/api/admin/seo").expect(401);
  await request(app).put("/api/admin/seo").send(seoDefaults).expect(401);
  await waiter.get("/api/admin/seo").expect(403);
  await waiter.put("/api/admin/seo").send(seoDefaults).expect(403);
  await admin.get("/api/admin/seo").expect(200);
});

test("SEO writes and business writes preserve each other's fields and stored business data", async () => {
  const seo = {
    ...seoDefaults,
    title: "Dinner in town",
    description: "Custom search description",
    shareTitle: "Visit us",
    shareImage: "/images/share.png",
  };
  await admin.put("/api/admin/seo").send(seo).expect(200);
  const business = await BusinessModel.getOne({ key: "main" }, { lean: true });
  assert.equal(business.name, "Original Restaurant");
  assert.equal(business.currency, "CRC");
  await admin
    .put("/api/admin/settings")
    .send({ ...business, phone: "12345678" })
    .expect(200);
  const read = await admin.get("/api/admin/seo").expect(200);
  assert.equal(read.body.title, seo.title);
  const response = await request(app).get("/api/seo").expect(200);
  assert.equal(response.body.shareTitle, "Visit us");
  assert.equal(response.body.image, origin + "/images/share.png");
});

test("product metadata and sitemap expose only active public catalog entries, never costs", async () => {
  const path = "/producto/" + product._id;
  const response = await request(app)
    .get("/api/seo")
    .query({ path })
    .expect(200);
  assert.match(response.body.title, /Dinner.*Dinner in town/);
  assert.equal(response.body.canonical, origin + path);
  assert.doesNotMatch(JSON.stringify(response.body), /purchasePrice|700/);
  const map = await request(app).get("/api/seo/sitemap").expect(200);
  assert.ok(map.body.urls.includes(origin + path));
  await ProductModel.update(String(product._id), { active: false });
  await request(app).get("/api/seo").query({ path }).expect(404);
  const after = await request(app).get("/api/seo/sitemap").expect(200);
  assert.ok(!after.body.urls.includes(origin + path));
});

test("SEO validates bounded text, paths, booleans and image schemes", async () => {
  for (const payload of [
    { title: "x".repeat(71) },
    { indexable: "true" },
    { shareImage: "javascript:alert(1)" },
    { shareImage: "https://user:password@example.com/img" },
    { locale: "../../en" },
    { unexpected: "field" },
  ])
    assert.throws(() => seoInput({ ...seoDefaults, ...payload }));
  for (const path of [
    "/admin",
    "//attacker.example",
    "/?token=private",
    "/producto/not-an-id",
  ])
    await request(app).get("/api/seo").query({ path }).expect(400);
});

test("disabling indexing disables the public sitemap", async () => {
  await admin
    .put("/api/admin/seo")
    .send({ ...seoDefaults, indexable: false })
    .expect(200);
  const response = await request(app).get("/api/seo").expect(200);
  assert.equal(response.body.indexable, false);
  const map = await request(app).get("/api/seo/sitemap").expect(200);
  assert.deepEqual(map.body.urls, []);
});
