import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Accounts, Product, Sale, Bill } from "../../models/models.js";
import { migrateLegacyCollections } from "../../db/migrate-legacy.js";
let replica;
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replica.getUri("canonical-migration-tests"));
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
});
beforeEach(async () => {
  for (const c of await mongoose.connection.db.collections())
    await c.deleteMany({});
});
after(async () => {
  await mongoose.disconnect();
  await replica?.stop();
});
test("migración conserva IDs, hashes, inventario, pedidos, cuentas y fuentes; solo se ejecuta una vez", async () => {
  const db = mongoose.connection.db;
  const user = await Accounts.save({
    name: "Owner",
    username: "owner",
    email: "owner@tests.local",
    password: "Preserved-password-2026!",
    role: "admin",
  });
  const stored = await db.collection("users").findOne({ _id: user._id });
  await db.collection("users").deleteOne({ _id: user._id });
  const productId = new mongoose.Types.ObjectId(),
    cartId = new mongoose.Types.ObjectId(),
    orderId = new mongoose.Types.ObjectId();
  await db.collection("restaurantaccounts").insertOne(stored);
  await db.collection("restaurantproducts").insertOne({
    _id: productId,
    name: "Original",
    category: "drink",
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
    await Accounts.compareHash(
      String(user._id),
      "password",
      "Preserved-password-2026!",
    ),
    true,
  );
  assert.equal((await Product.findById(productId)).stock, 17);
  assert.equal((await Sale.findById(orderId)).billId, String(cartId));
  assert.equal((await Bill.findById(cartId)).token, "preserved-qr-token");
  assert.equal(await db.collection("restaurantaccounts").countDocuments(), 1);
  await Product.updateOne({ _id: productId }, { $set: { stock: 12 } });
  await migrateLegacyCollections();
  assert.equal((await Product.findById(productId)).stock, 12);
});
test("un conflicto en cualquier colección revierte toda la migración sin borrar ni sobrescribir", async () => {
  const db = mongoose.connection.db,
    id = new mongoose.Types.ObjectId();
  await db.collection("restaurantaccounts").insertOne({
    _id: new mongoose.Types.ObjectId(),
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
