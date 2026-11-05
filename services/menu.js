import { OwlTransaction, OwlIsValidId } from "owl-expressjs-utils";
import { ProductModel, ProductTypeModel } from "../models/models.js";
import { Problem } from "./validation.js";
import { salesRanking } from "./sales-report.js";
import { productsWithInventory } from "./inventory.js";

const publicFields =
  "name description image category drinkType inventory price prices featured productType bottleMl";
const drinkTypes = new Set(["all", "alcoholic", "non_alcoholic"]);

function parameter(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "string")
    throw new Problem("Parámetros del menú inválidos.");
  return value.trim();
}
function positiveInteger(value, fallback, maximum) {
  const raw = parameter(value, String(fallback));
  if (!/^[1-9]\d*$/.test(raw) || Number(raw) > maximum)
    throw new Problem("Paginación del menú inválida.");
  return Number(raw);
}
export function searchPattern(query) {
  const accents = {
    a: "[aáàäâ]",
    e: "[eéèëê]",
    i: "[iíìïî]",
    o: "[oóòöô]",
    u: "[uúùüû]",
    n: "[nñ]",
  };
  return [
    ...query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase(),
  ]
    .map(
      (character) =>
        accents[character] ?? character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("");
}
export async function menuQuery(parameters = {}, session) {
  const category = parameter(parameters.category, "all");
  const types = await ProductTypeModel.getByCoincidence(
    { active: true },
    { session, lean: true },
  );
  const selectedType = types.find((t) => t.code === category);
  const drinkType = parameter(parameters.drinkType, "all");
  const search = parameter(parameters.q, "");
  if (
    (category !== "all" && !selectedType) ||
    !drinkTypes.has(drinkType) ||
    search.length > 100 ||
    (drinkType !== "all" && !selectedType?.requiresDrinkType)
  )
    throw new Problem("Filtros del menú inválidos.");
  const filter = { active: true, category: { $in: types.map((t) => t.code) } };
  if (category !== "all") filter.category = category;
  if (drinkType !== "all") filter.drinkType = drinkType;
  if (search)
    filter.$or = ["name", "description"].map((field) => ({
      [field]: { $regex: searchPattern(search), $options: "i" },
    }));
  return {
    filter,
    page: positiveInteger(parameters.page, 1, 100000),
    pageSize: positiveInteger(parameters.pageSize, 9, 24),
  };
}
export async function getMenuPage(parameters = {}) {
  return OwlTransaction(
    async (session) => {
      const query = await menuQuery(parameters, session);
      const total = await ProductModel.countDocuments(query.filter, {
        session,
      });
      const pageCount = Math.ceil(total / query.pageSize);
      const page = Math.min(query.page, Math.max(1, pageCount));
      const storedItems = await ProductModel.getByCoincidence(query.filter, {
        select: publicFields,
        sort: { name: 1, _id: 1 },
        skip: (page - 1) * query.pageSize,
        limit: query.pageSize,
        session,
        lean: true,
      });
      const items = await productsWithInventory(storedItems, session, {
        publicOnly: true,
      });
      return { items, total, page, pageSize: query.pageSize, pageCount };
    },
    { readConcern: { level: "snapshot" } },
  );
}
export async function getMenuProduct(id) {
  if (!OwlIsValidId(id)) throw new Problem("Producto inválido.");
  const product = await ProductModel.getOne(
    { _id: id, active: true },
    { select: publicFields, lean: true },
  );
  if (!product) throw new Problem("Este producto ya no está disponible.", 404);
  if (
    !(await ProductTypeModel.exists({ code: product.category, active: true }))
  )
    throw new Problem("Tipo de producto no disponible.", 404);
  return (
    await productsWithInventory([product], undefined, { publicOnly: true })
  )[0];
}

export async function getMenuRecommendations() {
  const ranking = await salesRanking();
  if (!ranking.length) return [];
  const activeTypes = await ProductTypeModel.getByCoincidence(
    { active: true },
    { select: "code", lean: true },
  );
  const storedProducts = await ProductModel.getByCoincidence(
    {
      active: true,
      category: { $in: activeTypes.map((type) => type.code) },
      _id: { $in: ranking.map((row) => row._id.productId) },
    },
    { select: publicFields, lean: true },
  );
  const products = await productsWithInventory(storedProducts, undefined, {
    publicOnly: true,
  });
  const byId = new Map(
    products.map((product) => [String(product._id), product]),
  );
  const totals = new Map();
  for (const row of ranking) {
    const id = String(row._id.productId);
    const previous = totals.get(id);
    totals.set(id, {
      id,
      quantity: (previous?.quantity ?? 0) + row.quantity,
      revenue: (previous?.revenue ?? 0) + row.revenue,
    });
  }
  const ordered = [...totals.values()].sort(
    (a, b) =>
      b.quantity - a.quantity ||
      b.revenue - a.revenue ||
      a.id.localeCompare(b.id),
  );
  const counts = new Map();
  return ordered.flatMap(({ id }) => {
    const product = byId.get(id);
    if (!product) return [];
    const category = product.category === "liquor" ? "drink" : product.category;
    if (!["food", "drink", "snack"].includes(category)) return [];
    const count = counts.get(category) ?? 0;
    if (count >= 2) return [];
    counts.set(category, count + 1);
    // Public projection intentionally excludes quantities, revenue and inventory.
    return [product];
  });
}
