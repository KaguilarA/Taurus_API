import { OwlTransaction, OwlIsValidId } from "owl-expressjs-utils";
import { ProductModel } from "../models/models.js";
import { Problem } from "./validation.js";

const publicFields =
  "name description image category drinkType inventory price prices featured";
const categories = new Set(["all", "food", "drink", "snack"]);
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
export function menuQuery(parameters = {}) {
  const category = parameter(parameters.category, "all");
  const drinkType = parameter(parameters.drinkType, "all");
  const search = parameter(parameters.q, "");
  if (
    !categories.has(category) ||
    !drinkTypes.has(drinkType) ||
    search.length > 100 ||
    (drinkType !== "all" && category !== "drink")
  )
    throw new Problem("Filtros del menú inválidos.");
  const filter = { active: true };
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
  const query = menuQuery(parameters);
  return OwlTransaction(
    async (session) => {
      const total = await ProductModel.countDocuments(query.filter, {
        session,
      });
      const pageCount = Math.ceil(total / query.pageSize);
      const page = Math.min(query.page, Math.max(1, pageCount));
      const items = await ProductModel.getByCoincidence(query.filter, {
        select: publicFields,
        sort: { name: 1, _id: 1 },
        skip: (page - 1) * query.pageSize,
        limit: query.pageSize,
        session,
        lean: true,
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
  return product;
}
