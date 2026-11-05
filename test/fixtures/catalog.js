import {
  ProductModel,
  ProductStockModel,
  ProductTypeModel,
} from "../../models/models.js";
import { migrateCatalog } from "../../db/migrate-catalog.js";

export async function saveProduct(data, options = {}) {
  const { stock = 0, minimum = 0, ...fields } = data;
  if (fields.category === "drink" && fields.inventory === "ml")
    fields.category = "liquor";
  if (fields.category === "snack" && fields.inventory === "none")
    fields.inventory = "unit";
  const type = await ProductTypeModel.getOne(
    { code: fields.category },
    options,
  );
  const product = await ProductModel.save(
    { ...fields, productType: type._id },
    options,
  );
  if (product.inventory !== "none")
    await ProductStockModel.save(
      { owner: product._id, stock, minimum },
      options,
    );
  // Opening balances returned only to fixture movement generation; never stored on Product.
  product.stock = stock;
  return product;
}
export async function saveProducts(data, options) {
  const result = [];
  for (const fields of data) result.push(await saveProduct(fields, options));
  return result;
}
export async function stockFor(id) {
  return (await ProductStockModel.getOne({ owner: id }))?.stock ?? 0;
}
export const initializeCatalog = () => migrateCatalog({ maintenance: true });
