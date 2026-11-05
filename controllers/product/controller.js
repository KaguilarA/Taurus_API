import {
  productTypeFor,
  productTypeInput,
} from "../../services/product-types.js";
import {
  changeStock,
  productsWithInventory,
} from "../../services/inventory.js";
import { getMenuPage, getMenuProduct } from "../../services/menu.js";
import { OwlController, OwlTransaction } from "owl-expressjs-utils";
import {
  ProductModel,
  ProductStockModel,
  ProductTypeModel,
  StockMovementModel,
} from "../../models/models.js";
import {
  Problem,
  productInput,
  text,
  number,
} from "../../services/validation.js";
export function createProductController() {
  const register = async (req, res) => {
    const result = await OwlTransaction(async (session) => {
      const type = await productTypeFor(req.body, session);
      const data = productInput(req.body, type);
      const minimum = number(req.body.minimum ?? 0, "Mínimo", 0, true);
      if (data.inventory === "none" && minimum)
        throw new Problem("Un producto sin inventario no puede tener mínimo.");
      await ProductTypeModel.updateWhere(
        { _id: type._id, active: true },
        { $inc: { revision: 1 } },
        { session },
      );
      const [product] = await ProductModel.saveMany([data], { session });
      if (data.inventory !== "none")
        await ProductStockModel.saveMany(
          [{ owner: product._id, stock: 0, minimum }],
          { session },
        );
      return (await productsWithInventory([product.toObject()], session))[0];
    });
    res.status(201).json(result);
  };
  const update = async (req, res) => {
    const result = await OwlTransaction(async (session) => {
      const type = await productTypeFor(req.body, session);
      const data = productInput(req.body, type);
      const current = await ProductModel.getById(req.params.id, { session });
      if (!current) throw new Problem("Producto no encontrado.", 404);
      if (current.inventory !== data.inventory)
        throw new Problem(
          "El tipo de inventario no puede cambiar. Archiva el producto y crea otro.",
        );
      await ProductTypeModel.updateWhere(
        { _id: type._id, active: true },
        { $inc: { revision: 1 } },
        { session },
      );
      if (data.inventory !== "none" && req.body.minimum !== undefined) {
        const stock = await ProductStockModel.updateWhere(
          { owner: current._id },
          { $set: { minimum: number(req.body.minimum, "Mínimo", 0, true) } },
          { session, new: true, runValidators: true },
        );
        if (!stock) throw new Problem("Inventario no configurado.", 409);
      }
      const product = await ProductModel.update(current._id, data, {
        session,
        runValidators: true,
      });
      return (await productsWithInventory([product.toObject()], session))[0];
    });
    res.json(result);
  };
  const adjustStock = async (req, res) => {
    const delta = number(req.body.delta, "Movimiento", -1e9, true);
    if (!delta) throw new Problem("El movimiento no puede ser cero.");
    const reason = text(req.body.reason, "Motivo", 250, true);
    const result = await OwlTransaction(async (session) => {
      const product = await ProductModel.getById(req.params.id, { session });
      if (!product) throw new Problem("Producto no encontrado.", 404);
      const stock = await changeStock(product, delta, session);
      await StockMovementModel.saveMany(
        [
          {
            productId: String(product._id),
            productName: product.name,
            delta,
            unit: product.inventory,
            reason,
            balance: stock.stock,
          },
        ],
        { session },
      );
      return (await productsWithInventory([product.toObject()], session))[0];
    });
    res.json(result);
  };
  const listTypes = async (req, res) =>
    res.json(
      await ProductTypeModel.getByCoincidence(
        {},
        { sort: { name: 1 }, lean: true },
      ),
    );
  const typeCrud = OwlController({
    entityId: "ProductType",
    model: ProductTypeModel,
  });
  const registerType = async (req, res) => {
    req.body = productTypeInput(req.body);
    return typeCrud.register(req, res);
  };
  const updateType = async (req, res) => {
    const result = await OwlTransaction(async (session) => {
      const current = await ProductTypeModel.getById(req.params.id, {
        session,
      });
      if (!current) throw new Problem("Tipo de producto no encontrado.", 404);
      const data = productTypeInput(req.body, current);
      const incompatible = await ProductModel.exists(
        {
          productType: current._id,
          $or: [
            { inventory: { $nin: data.inventoryModes } },
            ...(data.requiresDrinkType
              ? [{ drinkType: { $nin: ["alcoholic", "non_alcoholic"] } }]
              : []),
          ],
        },
        { session },
      );
      if (incompatible)
        throw new Problem(
          "El cambio es incompatible con productos existentes.",
          409,
        );
      return ProductTypeModel.update(
        current._id,
        { $set: data, $inc: { revision: 1 } },
        { session, runValidators: true },
      );
    });
    res.json(result);
  };
  return { register, update, adjustStock, listTypes, registerType, updateType };
}
export default createProductController;
export function createPublicProductController() {
  const list = async (req, res) => res.json(await getMenuPage(req.query));
  const detail = async (req, res) =>
    res.json(await getMenuProduct(req.params.id));
  const types = async (req, res) =>
    res.json(
      await ProductTypeModel.getByCoincidence(
        { active: true },
        {
          select:
            "_id code name description inventoryModes requiresDrinkType kitchen",
          sort: { name: 1 },
          lean: true,
        },
      ),
    );
  return { list, detail, types };
}
