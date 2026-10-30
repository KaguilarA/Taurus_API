import { getMenuPage, getMenuProduct } from "../../services/menu.js";
import { OwlController, OwlTransaction } from "owl-expressjs-utils";
import { ProductModel, StockMovementModel } from "../../models/models.js";

import {
  Problem,
  productInput,
  text,
  number,
} from "../../services/validation.js";
export function createProductController() {
  const crud = OwlController({ entityId: "Product", model: ProductModel });
  const register = async (req, res) => {
    req.body = productInput(req.body);
    return crud.register(req, res);
  };
  const update = async (req, res) => {
    const data = productInput(req.body);
    const result = await OwlTransaction(async (session) => {
      const current = await ProductModel.getById(req.params.id, {
        session: session,
      });
      if (!current) throw new Problem("Producto no encontrado.", 404);
      if (current.inventory !== data.inventory)
        throw new Problem(
          "El tipo de inventario no puede cambiar. Archiva el producto y crea otro.",
        );
      return ProductModel.update(current._id, data, {
        session,
        runValidators: true,
      });
    });
    res.json(result);
  };
  const adjustStock = async (req, res) => {
    const delta = number(req.body.delta, "Movimiento", -1e9, true);
    if (!delta) throw new Problem("El movimiento no puede ser cero.");
    const reason = text(req.body.reason, "Motivo", 250, true);
    let result;
    await OwlTransaction(async (session) => {
      result = await ProductModel.updateWhere(
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
      await StockMovementModel.saveMany(
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

export function createPublicProductController() {
  const list = async (req, res) => res.json(await getMenuPage(req.query));
  const detail = async (req, res) =>
    res.json(await getMenuProduct(req.params.id));
  return { list, detail };
}
