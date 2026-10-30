import { OwlController } from "owl-expressjs-utils";
import { ProductModel } from "../../models/models.js";

import { Product, Movement } from "../../models/models.js";
import {
  Problem,
  productInput,
  text,
  number,
} from "../../services/validation.js";
import mongoose from "mongoose";

export function createProductController() {
  const crud = OwlController({ entityId: "Product", model: ProductModel });
  const register = async (req, res) => {
    req.body = productInput(req.body);
    return crud.register(req, res);
  };
  const update = async (req, res) => {
    const data = productInput(req.body);
    const result = await mongoose.connection.transaction(async (session) => {
      const current = await Product.findById(req.params.id).session(session);
      if (!current) throw new Problem("Producto no encontrado.", 404);
      if (current.inventory !== data.inventory)
        throw new Problem(
          "El tipo de inventario no puede cambiar. Archiva el producto y crea otro.",
        );
      Object.assign(current, data);
      await current.save({ session });
      return current;
    });
    res.json(result);
  };
  const adjustStock = async (req, res) => {
    const delta = number(req.body.delta, "Movimiento", -1e9, true);
    if (!delta) throw new Problem("El movimiento no puede ser cero.");
    const reason = text(req.body.reason, "Motivo", 250, true);
    let result;
    await mongoose.connection.transaction(async (session) => {
      result = await Product.findOneAndUpdate(
        {
          _id: req.params.id,
          inventory: { $ne: "none" },
          stock: { $gte: Math.max(0, -delta) },
        },
        { $inc: { stock: delta } },
        { new: true, session },
      );
      if (!result)
        throw new Problem("Producto sin inventario o saldo insuficiente.", 409);
      await Movement.create(
        [
          {
            productId: String(result._id),
            productName: result.name,
            delta,
            unit: result.inventory,
            reason,
            balance: result.stock,
          },
        ],
        { session },
      );
    });
    res.json(result);
  };
  return { register, update, adjustStock };
}

export default createProductController;
