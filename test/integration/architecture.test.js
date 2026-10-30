import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { existsSync } from "node:fs";
import { createApp } from "../../app.js";
import { UserModel, ProductModel, CartModel } from "../../models/models.js";
test("registro canónico reutiliza las entidades originales y no crea modelos Restaurant paralelos", () => {
  assert.ok(UserModel.compareHash);
  assert.ok(ProductModel.save);
  assert.ok(CartModel.update);
  assert.equal(
    mongoose.modelNames().some((n) => n.startsWith("Restaurant")),
    false,
  );
  for (const [model, fields] of [
    ["User", ["name", "lastname", "state", "username", "password"]],
    ["Product", ["name", "state", "category", "drinkType"]],
    ["Cart", ["user", "state", "token", "paymentMethod"]],
  ])
    for (const field of fields)
      assert.ok(mongoose.model(model).schema.path(field));
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
