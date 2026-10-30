import {
  OwlMongoConnect,
  OwlDatabase,
  OwlMongoClose,
  OwlObjectId,
} from "owl-expressjs-utils";
import {
  UserModel,
  ProductModel,
  OrderModel,
  CartModel,
  registeredModels,
} from "../../models/models.js";
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import { migrateLegacyCollections } from "../../db/migrate-legacy.js";
let replica;
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await OwlMongoConnect(replica.getUri("canonical-migration-tests"));
  await Promise.all(registeredModels.map((m) => m.initialize()));
});
beforeEach(async () => {
  for (const c of await OwlDatabase().collections()) await c.deleteMany({});
});
after(async () => {
  await OwlMongoClose();
  await replica?.stop();
});
test("migración conserva IDs, hashes, inventario, pedidos, cuentas y fuentes; solo se ejecuta una vez", async () => {
  const db = OwlDatabase();
  const user = await UserModel.save({
    name: "Owner",
    username: "owner",
    email: "owner@tests.local",
    password: "Preserved-password-2026!",
    role: "admin",
  });
  const stored = await db.collection("users").findOne({ _id: user._id });
  await db.collection("users").deleteOne({ _id: user._id });
  const productId = new OwlObjectId(),
    cartId = new OwlObjectId(),
    orderId = new OwlObjectId();
  await db.collection("restaurantaccounts").insertOne(stored);
  await db.collection("restaurantproducts").insertOne({
    _id: productId,
    name: "Original",
    category: "drink",
    drinkType: "alcoholic",
    inventory: "unit",
    price: 1500,
    stock: 17,
  });
  await db.collection("restaurantbills").insertOne({
    _id: cartId,
    tableId: "original-table",
    token: "preserved-qr-token",
    status: "open",
    total: 1500,
  });
  await db.collection("restaurantsales").insertOne({
    _id: orderId,
    billId: String(cartId),
    requestId: "unchanged-request",
    items: [{ productId: String(productId), quantity: 1 }],
    total: 1500,
  });
  await assert.rejects(() => migrateLegacyCollections(), /MAINTENANCE_MODE/);
  assert.equal(await db.collection("users").countDocuments(), 0);
  await Promise.all([
    migrateLegacyCollections({ maintenance: true }),
    migrateLegacyCollections({ maintenance: true }),
  ]);
  assert.equal(
    (await db.collection("users").findOne({ _id: user._id })).password,
    stored.password,
  );
  assert.equal(
    await UserModel.compareHash(
      String(user._id),
      "password",
      "Preserved-password-2026!",
    ),
    true,
  );
  assert.equal((await ProductModel.getById(productId)).stock, 17);
  assert.equal((await OrderModel.getById(orderId)).billId, String(cartId));
  assert.equal((await CartModel.getById(cartId)).token, "preserved-qr-token");
  assert.equal(await db.collection("restaurantaccounts").countDocuments(), 1);
  await ProductModel.updateWhere({ _id: productId }, { $set: { stock: 12 } });
  await migrateLegacyCollections();
  assert.equal((await ProductModel.getById(productId)).stock, 12);
});
test("un conflicto en cualquier colección revierte toda la migración sin borrar ni sobrescribir", async () => {
  const db = OwlDatabase(),
    id = new OwlObjectId();
  await db.collection("restaurantaccounts").insertOne({
    _id: new OwlObjectId(),
    username: "copy-must-rollback",
  });
  await db
    .collection("restaurantproducts")
    .insertOne({ _id: id, name: "Source" });
  await db.collection("products").insertOne({ _id: id, name: "Existing" });
  await assert.rejects(
    () => migrateLegacyCollections({ maintenance: true }),
    /conflicto/,
  );
  assert.equal(await db.collection("users").countDocuments(), 0);
  assert.equal(
    (await db.collection("products").findOne({ _id: id })).name,
    "Existing",
  );
  assert.equal(await db.collection("restaurantproducts").countDocuments(), 1);
});
