import mongoose from "mongoose";
import { Product, Movement } from "../models/models.js";
import { Problem, saleLine } from "./validation.js";

// All callers reserve stock in the same transaction that records the order.
export async function reserveItems(items, session) {
  if (!Array.isArray(items) || !items.length || items.length > 100)
    throw new Problem("Agrega entre 1 y 100 líneas.");
  const settings = await mongoose
    .model("Business")
    .findOne({ key: "main" })
    .session(session);
  if (!settings)
    throw new Problem(
      "Completá la información del negocio antes de registrar pedidos.",
      409,
    );
  const lines = [],
    movements = [];
  for (const input of items) {
    if (!input || !mongoose.isValidObjectId(input.productId))
      throw new Problem("Producto inválido.");
    const product = await Product.findOne({
      _id: input.productId,
      active: true,
    }).session(session);
    if (!product) throw new Problem("Producto no disponible.", 409);
    const line = saleLine(product, input, settings.servings);
    if (line.consumed) {
      const updated = await Product.findOneAndUpdate(
        { _id: product._id, stock: { $gte: line.consumed } },
        { $inc: { stock: -line.consumed } },
        { new: true, session },
      );
      if (!updated)
        throw new Problem(`Inventario insuficiente: ${product.name}.`, 409);
      movements.push({
        productId: product.id,
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
    await Movement.create(
      movements.map((m) => ({ ...m, saleId: sale.id })),
      { session, ordered: true },
    );
}

export function paymentMethod(value) {
  if (!["cash", "sinpe", "card"].includes(value))
    throw new Problem("Seleccioná efectivo, SIMPE o tarjeta.");
  return value;
}
