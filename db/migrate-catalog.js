import {
  OwlCollection,
  OwlTransaction,
  OwlObjectId,
} from "owl-expressjs-utils";
import { ConfigurationError } from "../config/runtime.js";
import { isDeepStrictEqual } from "node:util";
import { normalizeInventory } from "./normalize-inventory.js";

export const initialProductTypes = [
  { code: "food", name: "Comidas", inventoryModes: ["none"], kitchen: true },
  {
    code: "drink",
    name: "Bebidas",
    inventoryModes: ["unit"],
    requiresDrinkType: true,
  },
  { code: "snack", name: "Snacks", inventoryModes: ["unit"] },
  { code: "liquor", name: "Botellas de licor", inventoryModes: ["ml"] },
];
const migrationId = "product-catalog-stock-v1";
const fail = (message) => {
  throw new ConfigurationError(`Migración de catálogo detenida: ${message}`);
};
const validBalance = (value) => Number.isSafeInteger(value) && value >= 0;

async function plan(session) {
  const options = { session };
  const products = await OwlCollection("products").find({}, options).toArray();
  const stocks = await OwlCollection("productstocks")
    .find({}, options)
    .toArray();
  const types = await OwlCollection("producttypes").find({}, options).toArray();
  const byOwner = new Map();
  for (const stock of stocks) {
    const owner = String(stock.owner);
    if (byOwner.has(owner))
      fail("hay varios registros de inventario para un producto.");
    if (!products.some((p) => String(p._id) === owner))
      fail("hay inventario sin producto asociado.");
    if (!validBalance(stock.stock) || !validBalance(stock.minimum ?? 0))
      fail("hay saldos o mínimos inválidos.");
    byOwner.set(owner, stock);
  }
  const codes = new Set();
  const names = new Set();
  for (const type of types) {
    if (typeof type.name !== "string" || !type.name.trim())
      fail("hay tipos sin nombre válido.");
    const standard = initialProductTypes.find(
      (t) =>
        t.code === type.code ||
        t.name.toLowerCase() === type.name?.toLowerCase(),
    );
    type.code ??=
      standard?.code ??
      type.name
        ?.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    if (
      !/^[a-z][a-z0-9_-]*$/.test(type.code ?? "") ||
      type.code === "all" ||
      codes.has(type.code) ||
      names.has(type.name)
    )
      fail("hay tipos con códigos o nombres en conflicto.");
    codes.add(type.code);
    names.add(type.name);
    type.inventoryModes = type.inventoryModes?.length
      ? type.inventoryModes
      : (standard?.inventoryModes ?? ["none"]);
    type.kitchen ??= standard?.kitchen ?? false;
    type.requiresDrinkType ??= standard?.requiresDrinkType ?? false;
    type.active ??= true;
    if (type.inventoryModes.includes("ml") && type.code !== "liquor")
      fail("solo Botellas de licor puede utilizar mililitros.");
  }
  for (const standard of initialProductTypes) {
    const existing = types.find((t) => t.code === standard.code);
    if (!existing) {
      if (types.some((t) => t.name === standard.name))
        fail("el nombre de un tipo inicial ya está asignado a otro código.");
      types.push({
        _id: new OwlObjectId(),
        active: true,
        kitchen: false,
        requiresDrinkType: false,
        ...standard,
      });
    }
  }
  const entries = [];
  for (const product of products) {
    const references = product.productType
      ? [product.productType]
      : Array.isArray(product.type)
        ? product.type
        : product.type
          ? [product.type]
          : [];
    if (references.length > 1)
      fail("un producto tiene varios tipos; debe resolverse explícitamente.");
    let type = references.length
      ? types.find((t) => String(t._id) === String(references[0]))
      : types.find((t) => t.code === product.category);
    if (!type) fail("hay productos sin un tipo reconocible.");
    if (product.category && product.category !== type.code)
      fail("la categoría y el tipo de un producto no coinciden.");
    let inventory =
      product.inventory ??
      (type.inventoryModes.length === 1 ? type.inventoryModes[0] : undefined);
    if (type.code === "drink" && inventory === "ml")
      type = types.find((t) => t.code === "liquor");
    if (type.code === "snack" && inventory === "none") inventory = "unit";
    if (!type.inventoryModes.includes(inventory))
      fail("el inventario de un producto no coincide con su tipo.");
    if (
      inventory === "ml" &&
      (!Number.isSafeInteger(product.bottleMl) || product.bottleMl <= 0)
    )
      fail("hay botellas sin capacidad válida en mililitros.");
    const stock = byOwner.get(String(product._id));
    const balance = stock?.stock ?? product.stock ?? 0;
    const minimum = stock?.minimum ?? product.minimum ?? 0;
    if (!validBalance(balance) || !validBalance(minimum))
      fail("hay saldos o mínimos inválidos.");
    if (stock && product.stock !== undefined && stock.stock !== product.stock)
      fail("el saldo de Product y ProductStock difiere.");
    if (
      stock?.minimum !== undefined &&
      product.minimum !== undefined &&
      stock.minimum !== product.minimum
    )
      fail("el mínimo de Product y ProductStock difiere.");
    if (inventory === "none" && (stock || balance || minimum))
      fail("un producto sin inventario tiene existencias o mínimos.");
    entries.push({ product, type, inventory, stock, balance, minimum });
  }
  return { types, entries };
}

export async function migrateCatalog({
  maintenance = process.env.MAINTENANCE_MODE === "true",
} = {}) {
  const marker = OwlCollection("applicationmigrations");
  if (!(await marker.findOne({ _id: migrationId }))?.done) {
    const populated = await OwlCollection("products").findOne({});
    if (populated && !maintenance)
      fail(
        "se requiere MAINTENANCE_MODE=true antes de migrar productos existentes.",
      );
    await plan(); // Refuse all data conflicts before changing indexes or records.
    const stockCollection = OwlCollection("productstocks");
    let indexes = [];
    try {
      indexes = await stockCollection.listIndexes().toArray();
    } catch (error) {
      if (error.code !== 26) throw error;
    }
    for (const index of indexes)
      if (
        index.unique &&
        Object.keys(index.key).length === 1 &&
        index.key.stock === 1
      )
        try {
          await stockCollection.dropIndex(index.name);
        } catch (error) {
          if (error.code !== 27) throw error;
        }
    await marker.updateOne(
      { _id: migrationId },
      { $setOnInsert: { done: false, revision: 0 } },
      { upsert: true },
    );
    await OwlTransaction(async (session) => {
      const options = { session };
      const lock = await marker.findOneAndUpdate(
        { _id: migrationId },
        { $inc: { revision: 1 } },
        { ...options, returnDocument: "after" },
      );
      if (lock.done) return;
      const { types, entries } = await plan(session);
      for (const type of types) {
        const { _id, ...data } = type;
        await OwlCollection("producttypes").updateOne(
          { _id },
          { $set: data },
          { ...options, upsert: true },
        );
      }
      for (const {
        product,
        type,
        inventory,
        stock,
        balance,
        minimum,
      } of entries) {
        await OwlCollection("products").updateOne(
          { _id: product._id },
          {
            $set: {
              productType: type._id,
              category: type.code,
              inventory,
              legacyCatalog: {
                category: product.category,
                inventory: product.inventory,
                type: product.type,
                stock: product.stock,
                minimum: product.minimum,
              },
            },
            $unset: { stock: "", minimum: "", type: "" },
          },
          options,
        );
        if (inventory !== "none")
          await stockCollection.updateOne(
            stock ? { _id: stock._id } : { owner: product._id },
            stock
              ? { $set: { minimum, owner: product._id } }
              : {
                  $setOnInsert: { owner: product._id, stock: balance, minimum },
                },
            { ...options, upsert: true },
          );
      }
      await marker.updateOne(
        { _id: migrationId },
        { $set: { done: true, completedAt: new Date() } },
        options,
      );
    });
  }
  await OwlCollection("productstocks").createIndex(
    { owner: 1 },
    { unique: true },
  );
  await OwlCollection("producttypes").createIndex(
    { code: 1 },
    { unique: true, sparse: true },
  );
  await archiveCatalogSources({ maintenance });
  await normalizeInventory({ maintenance });
}

// Upgrade installations that already ran v1 without re-importing stale balances.
async function archiveCatalogSources({ maintenance }) {
  const marker = OwlCollection("applicationmigrations");
  const id = "product-catalog-source-archive-v2";
  if ((await marker.findOne({ _id: id }))?.done) return;
  const products = OwlCollection("products");
  const filter = {
    $or: [
      { stock: { $exists: true } },
      { minimum: { $exists: true } },
      { type: { $exists: true } },
    ],
  };
  if ((await products.findOne(filter)) && !maintenance)
    fail("se requiere MAINTENANCE_MODE=true para archivar campos antiguos.");
  await marker.updateOne(
    { _id: id },
    { $setOnInsert: { done: false, revision: 0 } },
    { upsert: true },
  );
  await OwlTransaction(async (session) => {
    const options = { session };
    const lock = await marker.findOneAndUpdate(
      { _id: id },
      { $inc: { revision: 1 } },
      { ...options, returnDocument: "after" },
    );
    if (lock.done) return;
    for await (const product of products.find(filter, options)) {
      if (
        product.inventory !== "none" &&
        !(await OwlCollection("productstocks").findOne(
          { owner: product._id },
          options,
        ))
      )
        fail(
          "falta el inventario canónico de un producto; se conserva el origen.",
        );
      const archive = { ...product.legacyCatalog };
      for (const field of ["stock", "minimum", "type"]) {
        if (!Object.hasOwn(product, field)) continue;
        if (
          Object.hasOwn(archive, field) &&
          !isDeepStrictEqual(archive[field], product[field])
        )
          fail("el respaldo de un campo antiguo difiere de su origen.");
        archive[field] = product[field];
      }
      await products.updateOne(
        { _id: product._id },
        {
          $set: { legacyCatalog: archive },
          $unset: { stock: "", minimum: "", type: "" },
        },
        options,
      );
    }
    await marker.updateOne(
      { _id: id },
      { $set: { done: true, completedAt: new Date() } },
      options,
    );
  });
}
