import { OwlCollection } from "owl-expressjs-utils";

// Add query indexes without replacing existing indexes or modifying documents.
export async function initializeQueryIndexes() {
  await Promise.all([
    OwlCollection("products").createIndex(
      { "supplierAliases.key": 1 },
      {
        unique: true,
        partialFilterExpression: { "supplierAliases.key": { $type: "string" } },
      },
    ),
    OwlCollection("stockmovements").createIndex(
      { importKey: 1 },
      { unique: true, sparse: true },
    ),
    OwlCollection("stockmovements").createIndex(
      { importNumberKey: 1 },
      { unique: true, sparse: true },
    ),
    OwlCollection("products").createIndex({
      active: 1,
      category: 1,
      name: 1,
      _id: 1,
    }),
    OwlCollection("orders").createIndex({ status: 1, createdAt: -1 }),
    OwlCollection("orders").createIndex({ billId: 1, status: 1 }),
    OwlCollection("stockmovements").createIndex({ createdAt: -1 }),
  ]);
}
