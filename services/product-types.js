import { OwlIsValidId } from "owl-expressjs-utils";
import { ProductTypeModel } from "../models/models.js";
import { Problem, text } from "./validation.js";

export async function productTypeFor(body, session) {
  if (body.productType !== undefined && !OwlIsValidId(body.productType))
    throw new Problem("Tipo de producto inválido.");
  const filter = body.productType
    ? { _id: body.productType }
    : { code: body.category };
  if (!body.productType && typeof body.category !== "string")
    throw new Problem("Seleccioná un tipo de producto.");
  const type = await ProductTypeModel.getOne(filter, { session, lean: true });
  if (!type || !type.active)
    throw new Problem("Tipo de producto no disponible.", 409);
  if (body.category !== undefined && body.category !== type.code)
    throw new Problem("El tipo y la categoría no coinciden.");
  return type;
}

export function productTypeInput(body, current) {
  const code = text(body.code ?? current?.code, "Código", 50, true);
  if (!/^[a-z][a-z0-9_-]*$/.test(code) || code === "all")
    throw new Problem("Código de tipo inválido.");
  if (current && code !== current.code)
    throw new Problem("El código del tipo no puede cambiar.");
  const modes = body.inventoryModes;
  if (
    !Array.isArray(modes) ||
    !modes.length ||
    new Set(modes).size !== modes.length ||
    modes.some((mode) => !["none", "unit", "ml"].includes(mode))
  )
    throw new Problem("Modos de inventario inválidos.");
  if (modes.includes("ml") && (code !== "liquor" || modes.length !== 1))
    throw new Problem("Solo Botellas de licor permite mililitros y medidas.");
  if (code === "liquor" && (modes.length !== 1 || modes[0] !== "ml"))
    throw new Problem(
      "Las botellas de licor requieren inventario en mililitros.",
    );
  for (const key of ["active", "kitchen", "requiresDrinkType"])
    if (body[key] !== undefined && typeof body[key] !== "boolean")
      throw new Problem(`${key}: valor inválido.`);
  return {
    code,
    name: text(body.name, "Nombre", 100, true),
    description: text(body.description ?? "", "Descripción"),
    inventoryModes: modes,
    active: body.active !== false,
    kitchen: body.kitchen === true,
    requiresDrinkType: body.requiresDrinkType === true,
  };
}
