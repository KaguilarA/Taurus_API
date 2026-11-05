import { changeStock } from "./inventory.js";
import { productTypeFor } from "./product-types.js";
import { OwlIsValidId } from "owl-expressjs-utils";
import {
  ProductModel,
  StockMovementModel,
  BusinessModel,
} from "../models/models.js";

import { Problem, saleLine } from "./validation.js";

// All callers reserve stock in the same transaction that records the order.
export async function reserveItems(items, session) {
  if (!Array.isArray(items) || !items.length || items.length > 100)
    throw new Problem("Agrega entre 1 y 100 líneas.");
  const settings = await BusinessModel.getOne(
    { key: "main" },
    { session: session },
  );
  if (!settings)
    throw new Problem(
      "Completá la información del negocio antes de registrar pedidos.",
      409,
    );
  const lines = [],
    movements = [];
  for (const input of items) {
    if (!input || !OwlIsValidId(input.productId))
      throw new Problem("Producto inválido.");
    const product = await ProductModel.getOne(
      {
        _id: input.productId,
        active: true,
      },
      { session: session },
    );
    if (!product) throw new Problem("Producto no disponible.", 409);
    const type = await productTypeFor(
      { productType: product.productType, category: product.category },
      session,
    );
    const line = {
      ...saleLine(product, input, settings.servings),
      kitchen: type.kitchen,
    };
    if (!type.inventoryModes.includes(product.inventory))
      throw new Problem(
        "El inventario no corresponde al tipo del producto.",
        409,
      );
    if (line.consumed) {
      const updated = await changeStock(product, -line.consumed, session);
      movements.push({
        productId: String(product._id),
        productName: product.name,
        delta: -line.consumed,
        unit: product.inventory,
        reason: "Pedido",
        balance: updated.stock,
      });
    }
    lines.push(line);
  }
  return {
    lines,
    movements,
    total:
      Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100,
  };
}

export async function recordMovements(movements, sale, session) {
  if (movements.length)
    await StockMovementModel.saveMany(
      movements.map((m) => ({ ...m, saleId: sale.id })),
      { session, ordered: true },
    );
}

export function paymentMethod(value) {
  if (!["cash", "sinpe", "card"].includes(value))
    throw new Problem("Seleccioná efectivo, SIMPE o tarjeta.");
  return value;
}
