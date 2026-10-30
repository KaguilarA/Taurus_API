import {
  UserModel,
  ProductModel,
  CartModel,
  registeredModels,
} from "../../models/models.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createApp } from "../../app.js";

test("registro canónico reutiliza las entidades originales y no crea modelos Restaurant paralelos", () => {
  assert.ok(UserModel.compareHash);
  assert.ok(ProductModel.save);
  assert.ok(CartModel.update);
  assert.equal(
    registeredModels
      .map((model) => model.modelName)
      .some((n) => n.startsWith("Restaurant")),
    false,
  );
  for (const [model, fields] of [
    ["User", ["name", "lastname", "state", "username", "password"]],
    ["Product", ["name", "state", "category", "drinkType"]],
    ["Cart", ["user", "state", "token", "paymentMethod"]],
  ])
    for (const field of fields)
      assert.ok(
        registeredModels
          .find((item) => item.modelName === model)
          .fieldNames.includes(field),
      );
  assert.equal(
    existsSync(new URL("../../restaurant/models.js", import.meta.url)),
    false,
  );
});
test("mantenimiento bloquea accesos de clientes y cambios, conservando checks operativos", async () => {
  const app = createApp({
    origin: "http://localhost:4200",
    maintenance: true,
    sessionMiddleware: (req, res, next) => next(),
  });
  for (const method of ["get", "post"])
    await request(app)
      [method]("/api/public")
      .expect(503)
      .expect("Retry-After", "60");
  await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: "must-not-reach-login" })
    .expect(503);
  await request(app).get("/api/health").expect(200);
  await request(app).get("/api/deployment").expect(200);
});

test("el backend no importa ni depende directamente de mongoose", () => {
  const root = new URL("../../", import.meta.url);
  const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  assert.equal(pkg.dependencies.mongoose, undefined);
  function check(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const url = new URL(
        entry.name + (entry.isDirectory() ? "/" : ""),
        directory,
      );
      if (entry.isDirectory()) check(url);
      else if (entry.name.endsWith(".js"))
        assert.doesNotMatch(readFileSync(url, "utf8"), /\bmongoose\b/);
    }
  }
  for (const name of [
    "controllers/",
    "services/",
    "models/",
    "db/",
    "middlewares/",
    "api/",
  ])
    check(new URL(name, root));
  for (const model of registeredModels) {
    assert.equal(typeof model.getOne, "function");
    assert.equal("schema" in model, false);
  }
});
