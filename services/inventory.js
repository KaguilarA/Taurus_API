import { ProductStockModel } from "../models/models.js";
import { Problem } from "./validation.js";

// This operation participates in the order/adjustment transaction supplied by the caller.
export async function changeStock(product, delta, session) {
  const stock = await ProductStockModel.updateWhere(
    {
      owner: product._id,
      unit: { $in: ["unit", "ml"] },
      stock: {
        $gte: Math.max(0, -delta),
        $lte: Number.MAX_SAFE_INTEGER - Math.max(0, delta),
      },
    },
    { $inc: { stock: delta } },
    { new: true, session },
  );
  if (!stock)
    throw new Problem(
      `Inventario insuficiente o no configurado: ${product.name}.`,
      409,
    );
  return stock;
}

export async function productsWithInventory(
  products,
  session,
  { publicOnly = false } = {},
) {
  if (!products.length) return [];
  const stocks = await ProductStockModel.getByCoincidence(
    { owner: { $in: products.map((p) => p._id) } },
    { session, lean: true, ...(publicOnly ? { select: "owner unit" } : {}) },
  );
  const balances = new Map(stocks.map((s) => [String(s.owner), s]));
  return products.map(
    ({
      stock: legacyStock,
      minimum: legacyMinimum,
      inventory: legacyInventory,
      legacyCatalog,
      purchasePrice,
      supplierAliases,
      type,
      ...product
    }) => ({
      ...product,
      ...(!publicOnly && purchasePrice !== undefined ? { purchasePrice } : {}),
      ...(!publicOnly && supplierAliases?.length ? { supplierAliases } : {}),
      inventory: balances.get(String(product._id))?.unit ?? "none",
      ...(!publicOnly
        ? {
            stock: balances.get(String(product._id))?.stock ?? 0,
            minimum: balances.get(String(product._id))?.minimum ?? 0,
          }
        : {}),
      bottleLiters: (product.bottleMl ?? 0) / 1000,
    }),
  );
}
