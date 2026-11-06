import { BusinessModel, ProductModel } from "../models/models.js";
import { getMenuProduct, menuQuery } from "./menu.js";
import { Problem, text, image } from "./validation.js";

const fields = "name subtitle description logoImage heroImage seo";
export const seoDefaults = {
  title: "",
  description: "",
  shareTitle: "",
  shareDescription: "",
  shareImage: "",
  locale: "es_CR",
  indexable: true,
  includeProducts: true,
};
export function seoInput(body = {}) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !Object.hasOwn(seoDefaults, key))
  )
    throw new Problem("Configuración SEO inválida.");
  for (const key of ["indexable", "includeProducts"])
    if (typeof body[key] !== "boolean")
      throw new Problem("Las opciones SEO deben ser booleanas.");
  const locale = text(body.locale, "Idioma y región", 10, true);
  if (!/^[a-z]{2}_[A-Z]{2}$/.test(locale))
    throw new Problem("Usá un idioma y región como es_CR.");
  const shareImage = image(body.shareImage ?? "");
  if (shareImage && shareImage.startsWith("https://")) {
    let url;
    try {
      url = new URL(shareImage);
    } catch {
      throw new Problem("Imagen social inválida.");
    }
    if (url.username || url.password)
      throw new Problem("La imagen no puede contener credenciales.");
  }
  return {
    title: text(body.title ?? "", "Título SEO", 70),
    description: text(body.description ?? "", "Descripción SEO", 200),
    shareTitle: text(body.shareTitle ?? "", "Título al compartir", 100),
    shareDescription: text(
      body.shareDescription ?? "",
      "Descripción al compartir",
      300,
    ),
    shareImage,
    locale,
    indexable: body.indexable,
    includeProducts: body.includeProducts,
  };
}
export function seoPath(value = "/") {
  if (
    typeof value !== "string" ||
    (value !== "/" && !/^\/producto\/[a-f\d]{24}$/.test(value))
  )
    throw new Problem("Ruta SEO pública inválida.");
  return value;
}
function absoluteImage(value, origin) {
  if (!value) return "";
  try {
    const url = new URL(value, origin);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export function metadata(business, origin, path = "/", product) {
  const seo = { ...seoDefaults, ...business?.seo };
  const name = business?.name ?? "";
  const title =
    seo.title || [name, business?.subtitle].filter(Boolean).join(" · ");
  const description = seo.description || business?.description || "";
  const prefix = product ? product.name + " · " : "";
  return {
    title: (prefix + title).slice(0, 160),
    description: (product?.description || description).slice(0, 500),
    shareTitle: (prefix + (seo.shareTitle || title)).slice(0, 200),
    shareDescription: (
      product?.description ||
      seo.shareDescription ||
      description
    ).slice(0, 500),
    image: absoluteImage(
      product?.image ||
        seo.shareImage ||
        business?.logoImage ||
        business?.heroImage,
      origin,
    ),
    siteName: name,
    locale: seo.locale,
    canonical: new URL(path, origin).href,
    indexable: !!name && seo.indexable,
  };
}
export async function getSeoMetadata(origin, path = "/") {
  path = seoPath(path);
  const [business, product] = await Promise.all([
    BusinessModel.getOne({ key: "main" }, { select: fields, lean: true }),
    path === "/"
      ? undefined
      : getMenuProduct(path.slice(10), { metadataOnly: true }),
  ]);
  return metadata(business, origin, path, product);
}
export async function getSeoSitemap(origin) {
  const business = await BusinessModel.getOne(
    { key: "main" },
    { select: fields, lean: true },
  );
  if (!business?.name || business.seo?.indexable === false) return [];
  const urls = [new URL("/", origin).href];
  if (business.seo?.includeProducts !== false) {
    const { filter } = await menuQuery({});
    const products = await ProductModel.getByCoincidence(filter, {
      select: "_id",
      limit: 1000,
      sort: { _id: 1 },
      lean: true,
    });
    urls.push(
      ...products.map(
        (product) => new URL("/producto/" + product._id, origin).href,
      ),
    );
  }
  return urls;
}
