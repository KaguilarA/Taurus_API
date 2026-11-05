import { OwlCollection, OwlTransaction } from "owl-expressjs-utils";

// Reports counts only: no credentials, customer records, prices or stock balances are logged.
export async function auditDatabaseIntegrity() {
  return OwlTransaction(
    async (session) => {
      const options = { session };
      const products = await OwlCollection("products")
        .find(
          {},
          {
            ...options,
            projection: {
              productType: 1,
              category: 1,
              inventory: 1,
              stock: 1,
              minimum: 1,
              type: 1,
              bottleMl: 1,
            },
          },
        )
        .toArray();
      const stocks = await OwlCollection("productstocks")
        .find({}, options)
        .toArray();
      const types = await OwlCollection("producttypes")
        .find({}, options)
        .toArray();
      const productIds = new Set(
        products.map((product) => String(product._id)),
      );
      const owners = new Map();
      const issues = {
        embeddedInventoryFields: 0,
        missingProductTypes: 0,
        mismatchedCategories: 0,
        missingInventories: 0,
        incompatibleInventoryModes: 0,
        orphanInventories: 0,
        duplicateInventories: 0,
        invalidBalances: 0,
        invalidInventoryUnits: 0,
        nonCanonicalInventoryOwners: 0,
        nonCanonicalProductTypes: 0,
        invalidBottleCapacities: 0,
        orphanOrderProducts: 0,
        orphanOrderBills: 0,
        orphanMovementProducts: 0,
        orphanMovementSales: 0,
        latestMovementBalanceMismatches: 0,
      };
      for (const stock of stocks) {
        if (typeof stock.owner?.toHexString !== "function")
          issues.nonCanonicalInventoryOwners++;
        if (!productIds.has(String(stock.owner))) issues.orphanInventories++;
        if (owners.has(String(stock.owner))) issues.duplicateInventories++;
        owners.set(String(stock.owner), stock);
        if (
          !Number.isSafeInteger(stock.stock) ||
          stock.stock < 0 ||
          !Number.isSafeInteger(stock.minimum ?? 0) ||
          (stock.minimum ?? 0) < 0
        )
          issues.invalidBalances++;
        if (!["unit", "ml"].includes(stock.unit))
          issues.invalidInventoryUnits++;
      }
      for (const product of products) {
        if (typeof product.productType?.toHexString !== "function")
          issues.nonCanonicalProductTypes++;
        if (
          ["stock", "minimum", "inventory", "type"].some((field) =>
            Object.hasOwn(product, field),
          )
        )
          issues.embeddedInventoryFields++;
        const type = types.find(
          (type) => String(type._id) === String(product.productType),
        );
        if (!type) {
          issues.missingProductTypes++;
          continue;
        }
        if (type.code !== product.category) issues.mismatchedCategories++;
        const stock = owners.get(String(product._id));
        if (!stock && !type.inventoryModes.includes("none"))
          issues.missingInventories++;
        if (stock && !type.inventoryModes.includes(stock.unit))
          issues.incompatibleInventoryModes++;
        if (
          stock?.unit === "ml" &&
          (type.code !== "liquor" ||
            !Number.isSafeInteger(product.bottleMl) ||
            product.bottleMl <= 0)
        )
          issues.invalidBottleCapacities++;
      }
      const orderChecks = await OwlCollection("orders")
        .aggregate(
          [
            {
              $facet: {
                products: [
                  { $unwind: "$items" },
                  {
                    $set: {
                      productObjectId: {
                        $convert: {
                          input: "$items.productId",
                          to: "objectId",
                          onError: null,
                          onNull: null,
                        },
                      },
                    },
                  },
                  {
                    $lookup: {
                      from: "products",
                      localField: "productObjectId",
                      foreignField: "_id",
                      as: "product",
                    },
                  },
                  { $match: { product: { $size: 0 } } },
                  { $count: "count" },
                ],
                bills: [
                  { $match: { billId: { $exists: true } } },
                  {
                    $set: {
                      billObjectId: {
                        $convert: {
                          input: "$billId",
                          to: "objectId",
                          onError: null,
                          onNull: null,
                        },
                      },
                    },
                  },
                  {
                    $lookup: {
                      from: "carts",
                      localField: "billObjectId",
                      foreignField: "_id",
                      as: "bill",
                    },
                  },
                  { $match: { bill: { $size: 0 } } },
                  { $count: "count" },
                ],
              },
            },
          ],
          options,
        )
        .toArray();
      issues.orphanOrderProducts = orderChecks[0]?.products[0]?.count ?? 0;
      issues.orphanOrderBills = orderChecks[0]?.bills[0]?.count ?? 0;
      const movementChecks = await OwlCollection("stockmovements")
        .aggregate(
          [
            {
              $facet: {
                products: [
                  {
                    $set: {
                      productObjectId: {
                        $convert: {
                          input: "$productId",
                          to: "objectId",
                          onError: null,
                          onNull: null,
                        },
                      },
                    },
                  },
                  {
                    $lookup: {
                      from: "products",
                      localField: "productObjectId",
                      foreignField: "_id",
                      as: "product",
                    },
                  },
                  { $match: { product: { $size: 0 } } },
                  { $count: "count" },
                ],
                sales: [
                  { $match: { saleId: { $exists: true, $ne: null } } },
                  {
                    $set: {
                      saleObjectId: {
                        $convert: {
                          input: "$saleId",
                          to: "objectId",
                          onError: null,
                          onNull: null,
                        },
                      },
                    },
                  },
                  {
                    $lookup: {
                      from: "orders",
                      localField: "saleObjectId",
                      foreignField: "_id",
                      as: "sale",
                    },
                  },
                  { $match: { sale: { $size: 0 } } },
                  { $count: "count" },
                ],
                latest: [
                  { $sort: { createdAt: -1, _id: -1 } },
                  {
                    $group: {
                      _id: "$productId",
                      balance: { $first: "$balance" },
                    },
                  },
                ],
              },
            },
          ],
          options,
        )
        .toArray();
      issues.orphanMovementProducts =
        movementChecks[0]?.products[0]?.count ?? 0;
      issues.orphanMovementSales = movementChecks[0]?.sales[0]?.count ?? 0;
      for (const movement of movementChecks[0]?.latest ?? []) {
        const stock = owners.get(String(movement._id));
        if (stock && stock.stock !== movement.balance)
          issues.latestMovementBalanceMismatches++;
      }
      const collections = {};
      for (const name of [
        "users",
        "carts",
        "orders",
        "stockmovements",
        "businesses",
      ])
        collections[name] = await OwlCollection(name).countDocuments(
          {},
          options,
        );
      return {
        database: "application",
        counts: {
          products: products.length,
          inventories: stocks.length,
          productTypes: types.length,
          ...collections,
        },
        issues,
        ok: Object.values(issues).every((count) => count === 0),
      };
    },
    { readConcern: { level: "snapshot" } },
  );
}
