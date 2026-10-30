export class Problem extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function usernameInput(value) {
  const username = text(value, "Usuario", 40, true).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username))
    throw new Problem(
      "Usá de 3 a 40 letras, números, puntos, guiones o guiones bajos para el usuario.",
    );
  return username;
}
export function text(value, name, max = 500, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new Problem(`${name}: texto inválido.`);
  return value.trim();
}
export function number(value, name, min = 0, integer = false, max = 1e9) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new Problem(`${name}: número inválido.`);
  return value;
}
export function image(value = "") {
  text(value, "Imagen", 2000);
  if (value && !/^https:\/\//.test(value) && !/^\/(?!\/)/.test(value))
    throw new Problem("Usa una imagen HTTPS o una ruta local /images/...");
  return value;
}
export function productInput(body) {
  const { category, inventory } = body;
  if (
    !["food", "drink", "snack"].includes(category) ||
    !["none", "unit", "ml"].includes(inventory) ||
    (["food", "snack"].includes(category) && inventory !== "none") ||
    (category === "drink" && inventory === "none")
  )
    throw new Problem(
      "Comidas y snacks sin inventario; bebidas por unidad o mililitros.",
    );
  if (
    body.drinkType &&
    !["non_alcoholic", "alcoholic"].includes(body.drinkType)
  )
    throw new Problem("Subtipo de bebida inv�lido.");
  const result = {
    drinkType: category === "drink" ? (body.drinkType ?? "") : "",
    name: text(body.name, "Nombre", 150, true),
    description: text(body.description ?? "", "Descripción"),
    image: image(body.image),
    category,
    inventory,
    price: number(body.price, "Precio"),
    bottleMl:
      inventory === "ml"
        ? number(body.bottleMl, "Botella", 1, true, 100000)
        : 0,
    minimum: number(body.minimum ?? 0, "Mínimo", 0, true),
    active: body.active !== false,
    featured: body.featured === true,
  };
  if (inventory === "ml")
    result.prices = Object.fromEntries(
      ["large", "small", "shot"].map((key) => [
        key,
        number(body.prices?.[key], `Precio ${key}`),
      ]),
    );
  else result.prices = {};
  return result;
}
export function saleLine(product, input, servings) {
  const quantity = number(input.quantity, "Cantidad", 1, true, 1000);
  let consumed = 0,
    unitPrice = product.price,
    serving = "unit";
  if (product.inventory === "ml") {
    serving = input.serving;
    if (!["large", "small", "shot"].includes(serving))
      throw new Problem("Selecciona grande, pequeño o shot.");
    consumed = number(servings[serving], "Medida", 1, true) * quantity;
    unitPrice = product.prices[serving];
  } else if (product.inventory === "unit") consumed = quantity;
  return {
    productId: String(product._id),
    name: product.name,
    category: product.category,
    serving,
    quantity,
    unitPrice,
    amount: (Math.round(unitPrice * 100) * quantity) / 100,
    consumed,
  };
}
