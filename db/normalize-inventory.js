import { OwlCollection, OwlTransaction } from "owl-expressjs-utils";
import { isDeepStrictEqual } from "node:util";
import { ConfigurationError } from "../config/runtime.js";

const migrationId = "product-stock-metadata-v3";
const reject = (message) => {
  throw new ConfigurationError(`Inventory normalization stopped: ${message}`);
};

async function inventoryPlan(session) {
  const options = { session };
  const products = await OwlCollection("products").find({}, options).toArray();
  const stocks = await OwlCollection("productstocks")
    .find({}, options)
    .toArray();
  const types = await OwlCollection("producttypes").find({}, options).toArray();
  const productIds = new Set(products.map((product) => String(product._id)));
  const owners = new Map();
  for (const stock of stocks) {
    const owner = String(stock.owner);
    if (!productIds.has(owner)) reject("an inventory record has no product.");
    if (owners.has(owner)) reject("a product has multiple inventory records.");
    if (
      !Number.isSafeInteger(stock.stock) ||
      stock.stock < 0 ||
      !Number.isSafeInteger(stock.minimum ?? 0) ||
      (stock.minimum ?? 0) < 0
    )
      reject("an inventory balance or minimum is invalid.");
    owners.set(owner, stock);
  }
  return products.map((product) => {
    const type = types.find(
      (type) => String(type._id) === String(product.productType),
    );
    if (!type || type.code !== product.category)
      reject("a product type reference or category is inconsistent.");
    const stock = owners.get(String(product._id));
    const mode =
      product.inventory ??
      stock?.unit ??
      (!stock && type.inventoryModes.includes("none") ? "none" : undefined);
    if (!type.inventoryModes.includes(mode))
      reject(
        "an inventory mode is missing or incompatible with its product type.",
      );
    if ((mode === "none") !== !stock)
      reject("the product inventory mode and inventory record disagree.");
    if (stock && stock.unit !== undefined && stock.unit !== mode)
      reject("the inventory unit conflicts with the product.");
    if (
      mode === "ml" &&
      (type.code !== "liquor" ||
        !Number.isSafeInteger(product.bottleMl) ||
        product.bottleMl <= 0)
    )
      reject("a liquor bottle has invalid capacity or type.");
    const archive = {
      ...(Object.hasOwn(product, "inventory")
        ? { inventory: product.inventory }
        : {}),
      ...(typeof product.productType === "string"
        ? { productType: product.productType }
        : {}),
    };
    if (
      Object.keys(archive).length &&
      product.legacyCatalog?.inventoryMetadataV3 &&
      !isDeepStrictEqual(product.legacyCatalog.inventoryMetadataV3, archive)
    )
      reject("the archived inventory metadata conflicts with its source.");
    if (
      stock &&
      typeof stock.owner === "string" &&
      stock.legacyNormalizationV3?.owner !== undefined &&
      stock.legacyNormalizationV3.owner !== stock.owner
    )
      reject("the archived inventory owner conflicts with its source.");
    return { product, stock, mode, archive, type };
  });
}

export async function normalizeInventory({
  maintenance = process.env.MAINTENANCE_MODE === "true",
} = {}) {
  const markers = OwlCollection("applicationmigrations");
  if ((await markers.findOne({ _id: migrationId }))?.done) return;
  if ((await OwlCollection("products").findOne({})) && !maintenance)
    reject(
      "MAINTENANCE_MODE=true is required before moving existing inventory metadata.",
    );
  await inventoryPlan();
  await markers.updateOne(
    { _id: migrationId },
    { $setOnInsert: { done: false, revision: 0 } },
    { upsert: true },
  );
  await OwlTransaction(async (session) => {
    const options = { session };
    const lock = await markers.findOneAndUpdate(
      { _id: migrationId },
      { $inc: { revision: 1 } },
      { ...options, returnDocument: "after" },
    );
    if (lock.done) return;
    const entries = await inventoryPlan(session);
    for (const { product, stock, mode, archive, type } of entries) {
      if (stock)
        await OwlCollection("productstocks").updateOne(
          { _id: stock._id },
          {
            $set: {
              unit: mode,
              owner: product._id,
              ...(typeof stock.owner === "string"
                ? { "legacyNormalizationV3.owner": stock.owner }
                : {}),
            },
          },
          options,
        );
      if (Object.keys(archive).length)
        await OwlCollection("products").updateOne(
          { _id: product._id },
          {
            $set: {
              "legacyCatalog.inventoryMetadataV3": archive,
              productType: type._id,
            },
            $unset: { inventory: "" },
          },
          options,
        );
    }
    await markers.updateOne(
      { _id: migrationId },
      {
        $set: {
          done: true,
          completedAt: new Date(),
          products: entries.length,
          inventories: entries.filter((entry) => entry.stock).length,
        },
      },
      options,
    );
  });
}
