import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import {
  OwlMongoConnect,
  OwlMongoClose,
  OwlCollection,
  OwlObjectId,
} from "owl-expressjs-utils";
import { normalizeInventory } from "../../db/normalize-inventory.js";
import { auditDatabaseIntegrity } from "../../db/integrity.js";

let replica;
const names = [
  "products",
  "productstocks",
  "producttypes",
  "applicationmigrations",
  "users",
  "carts",
  "orders",
  "stockmovements",
  "businesses",
  "sessions",
];
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await OwlMongoConnect(replica.getUri("inventory-integrity"), {
    autoIndex: false,
  });
});
beforeEach(async () => {
  for (const name of names) await OwlCollection(name).deleteMany({});
});
after(async () => {
  await OwlMongoClose();
  await replica?.stop();
});

async function storedInventory() {
  const typeId = new OwlObjectId(),
    productId = new OwlObjectId(),
    stockId = new OwlObjectId(),
    billId = new OwlObjectId(),
    saleId = new OwlObjectId();
  await OwlCollection("producttypes").insertOne({
    _id: typeId,
    code: "drink",
    name: "Bebidas",
    inventoryModes: ["unit"],
    active: true,
  });
  await OwlCollection("products").insertOne({
    _id: productId,
    category: "drink",
    productType: typeId,
    inventory: "unit",
    legacyCatalog: { inventory: "unit", stock: 10 },
    bottleMl: 0,
    price: 1234,
  });
  await OwlCollection("productstocks").insertOne({
    _id: stockId,
    owner: productId,
    stock: 7,
    minimum: 2,
  });
  await OwlCollection("users").insertOne({
    password: "preserved-stored-hash",
    username: "owner",
  });
  await OwlCollection("carts").insertOne({
    _id: billId,
    status: "paid",
    total: 1234,
  });
  await OwlCollection("orders").insertOne({
    _id: saleId,
    billId: String(billId),
    requestId: "historical",
    status: "paid",
    total: 1234,
    paymentMethod: "cash",
    items: [
      {
        productId: String(productId),
        category: "drink",
        quantity: 1,
        amount: 1234,
      },
    ],
  });
  await OwlCollection("stockmovements").insertOne({
    productId: String(productId),
    saleId: String(saleId),
    balance: 7,
    delta: -3,
    unit: "unit",
    createdAt: new Date(),
  });
  await OwlCollection("businesses").insertOne({
    name: "Stored business",
    servings: { shot: 30, small: 60, large: 90 },
  });
  await OwlCollection("sessions").insertOne({
    session: "preserved-session",
    expires: new Date("2030-01-01"),
  });
  return { typeId, productId, stockId };
}

test("moves inventory metadata atomically without changing balances, users, sessions, sales or settings", async () => {
  const ids = await storedInventory();
  const snapshots = new Map();
  for (const name of [
    "users",
    "sessions",
    "carts",
    "orders",
    "stockmovements",
    "businesses",
  ])
    snapshots.set(name, await OwlCollection(name).find({}).toArray());
  await assert.rejects(() => normalizeInventory(), /MAINTENANCE_MODE/);
  await normalizeInventory({ maintenance: true });
  const product = await OwlCollection("products").findOne({
    _id: ids.productId,
  });
  const stock = await OwlCollection("productstocks").findOne({
    _id: ids.stockId,
  });
  assert.equal(product.inventory, undefined);
  assert.equal(product.legacyCatalog.inventoryMetadataV3.inventory, "unit");
  assert.equal(product.legacyCatalog.stock, 10);
  assert.equal(stock.unit, "unit");
  assert.equal(stock.stock, 7);
  assert.equal(stock.minimum, 2);
  for (const [name, documents] of snapshots)
    assert.deepEqual(await OwlCollection(name).find({}).toArray(), documents);
  const audit = await auditDatabaseIntegrity();
  assert.equal(audit.ok, true);
  assert.equal(audit.counts.products, 1);
  assert.equal(audit.counts.inventories, 1);
  await OwlCollection("productstocks").updateOne(
    { _id: ids.stockId },
    { $inc: { stock: 5 } },
  );
  await normalizeInventory();
  assert.equal(
    (await OwlCollection("productstocks").findOne({ _id: ids.stockId })).stock,
    12,
  );
});

test("conflicting metadata prevents all normalization writes and retains the source", async () => {
  const ids = await storedInventory();
  await OwlCollection("productstocks").updateOne(
    { _id: ids.stockId },
    { $set: { unit: "ml" } },
  );
  const source = await OwlCollection("products").findOne({
    _id: ids.productId,
  });
  const stock = await OwlCollection("productstocks").findOne({
    _id: ids.stockId,
  });
  await assert.rejects(
    () => normalizeInventory({ maintenance: true }),
    /conflicts/,
  );
  assert.deepEqual(
    await OwlCollection("products").findOne({ _id: ids.productId }),
    source,
  );
  assert.deepEqual(
    await OwlCollection("productstocks").findOne({ _id: ids.stockId }),
    stock,
  );
  assert.equal(
    await OwlCollection("applicationmigrations").countDocuments(),
    0,
  );
});

test("audit reports dangling references and balance discrepancies without modifying business history", async () => {
  const ids = await storedInventory();
  await normalizeInventory({ maintenance: true });
  await OwlCollection("orders").insertOne({
    billId: String(new OwlObjectId()),
    items: [{ productId: String(new OwlObjectId()) }],
  });
  await OwlCollection("stockmovements").insertOne({
    productId: String(new OwlObjectId()),
    saleId: String(new OwlObjectId()),
    balance: 0,
  });
  await OwlCollection("productstocks").updateOne(
    { _id: ids.stockId },
    { $inc: { stock: 1 } },
  );
  const result = await auditDatabaseIntegrity();
  assert.equal(result.ok, false);
  assert.equal(result.issues.orphanOrderProducts, 1);
  assert.equal(result.issues.orphanOrderBills, 1);
  assert.equal(result.issues.orphanMovementProducts, 1);
  assert.equal(result.issues.orphanMovementSales, 1);
  assert.equal(result.issues.latestMovementBalanceMismatches, 1);
  assert.equal(result.issues.embeddedInventoryFields, 0);
  assert.equal(await OwlCollection("orders").countDocuments(), 2);
});

test("canonicalizes string references while preserving their original representation", async () => {
  const ids = await storedInventory();
  await OwlCollection("products").updateOne(
    { _id: ids.productId },
    { $set: { productType: String(ids.typeId) } },
  );
  await OwlCollection("productstocks").updateOne(
    { _id: ids.stockId },
    { $set: { owner: String(ids.productId) } },
  );
  await normalizeInventory({ maintenance: true });
  const product = await OwlCollection("products").findOne({
    _id: ids.productId,
  });
  const stock = await OwlCollection("productstocks").findOne({
    owner: ids.productId,
  });
  assert.ok(stock);
  assert.equal(typeof product.productType.toHexString, "function");
  assert.equal(
    product.legacyCatalog.inventoryMetadataV3.productType,
    String(ids.typeId),
  );
  assert.equal(stock.legacyNormalizationV3.owner, String(ids.productId));
  assert.equal((await auditDatabaseIntegrity()).ok, true);
});
