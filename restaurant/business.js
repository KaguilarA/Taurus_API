import { Problem, text, number, image } from "./domain.js";

export function businessInput(b = {}) {
  if (!/^[A-Z]{3}$/.test(b.currency) || !/^#[\da-fA-F]{6}$/.test(b.accent))
    throw new Problem("Moneda o color inválido.");
  try {
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: b.currency,
    });
  } catch {
    throw new Problem("Moneda inválida.");
  }
  return {
    name: text(b.name, "Nombre del negocio", 150, true),
    subtitle: text(b.subtitle ?? "", "Tipo de negocio", 150),
    tagline: text(b.tagline ?? "", "Eslogan", 200),
    description: text(b.description ?? "", "Descripción"),
    heroImage: image(b.heroImage),
    logoImage: image(b.logoImage),
    address: text(b.address ?? "", "Dirección"),
    hours: text(b.hours ?? "", "Horario"),
    phone: text(b.phone ?? "", "Teléfono", 50),
    currency: b.currency,
    accent: b.accent,
    servings: Object.fromEntries(
      ["large", "small", "shot"].map((key) => [
        key,
        number(b.servings?.[key], key, 1, true, 10000),
      ]),
    ),
  };
}
