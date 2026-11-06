import { createHash } from "node:crypto";
import { OwlIsValidId, OwlTransaction } from "owl-expressjs-utils";
import {
  ProductModel,
  StockMovementModel,
  BusinessModel,
} from "../models/models.js";
import { changeStock, productsWithInventory } from "./inventory.js";
import {
  readInvoice,
  validateInvoiceFile,
  validateInvoiceReading,
} from "./invoice-reading.js";
import { Problem, number, text } from "./validation.js";

export function invoiceIdentity(supplier, invoiceNumber) {
  // Quimar legal/trading names share one identity. Costa Rican keys contain the consecutive.
  const normalizedSupplier = /quimar/i.test(supplier)
    ? "quimar"
    : supplier
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
  const normalizedNumber = invoiceNumber
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  if (!normalizedSupplier) throw new Problem("Indicá un proveedor válido.");
  if (!normalizedNumber)
    throw new Problem("Indicá el número de factura para evitar duplicados.");
  const consecutive = /^506\d{47}$/.test(normalizedNumber)
    ? normalizedNumber.slice(21, 41)
    : normalizedNumber;
  return `${normalizedSupplier}:${consecutive}`;
}

export function supplierAliasKey(supplier, name) {
  const supplierKey = invoiceIdentity(supplier, "alias").split(":")[0];
  const normalizedName = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\b\d+(?:[.,]\d+)?\s*%/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return createHash("sha256")
    .update(`${supplierKey}|${normalizedName}`)
    .digest("hex");
}

function productNameKeys(name, supplier) {
  const key = matchName(name);
  const keys = [key];
  // Quimar names the brand explicitly; our catalog may name only the variant.
  if (/quimar/i.test(supplier)) {
    const variant = key.replace(/^imperial /, "");
    if (["silver", "ultra", "light"].includes(variant))
      keys.push(variant, `imperial ${variant}`);
  }
  return [...new Set(keys)];
}

function matchName(value) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\b\d+(?:[.,]\d+)?\s*%/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*ml\b/g, " ")
    .replace(/\b1\s*x\s*\d+\b/g, " ")
    .replace(/\b(vidrio|media)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function invoicePreview(file, actorId, reader = readInvoice) {
  validateInvoiceFile(file);
  const fileHash = createHash("sha256").update(file.buffer).digest("hex");
  if (await StockMovementModel.exists({ importKey: fileHash }))
    throw new Problem(
      "Esta factura ya fue registrada. No se volvió a sumar inventario.",
      409,
    );
  let invoice;
  try {
    const reading = await reader(file);
    invoice = { ...validateInvoiceReading(reading), source: reading.source };
  } finally {
    file.buffer.fill(0);
  }
  const [duplicate, products] = await Promise.all([
    invoice.invoiceNumber
      ? StockMovementModel.exists({
          importNumberKey: createHash("sha256")
            .update(invoiceIdentity(invoice.supplier, invoice.invoiceNumber))
            .digest("hex"),
        })
      : false,
    ProductModel.getByCoincidence(
      { active: true },
      {
        lean: true,
        select: "name bottleMl active supplierAliases",
        limit: 2001,
      },
    ).then((stored) => productsWithInventory(stored)),
  ]);
  if (duplicate)
    throw new Problem(
      "Ese número de factura ya fue registrado, incluso con otro archivo.",
      409,
    );
  if (products.length > 2000)
    throw new Problem(
      "El catálogo excede el límite de 2.000 productos para esta importación.",
      422,
    );
  const tracked = products.filter((product) => product.inventory !== "none");
  const matchesByName = new Map();
  const matchesByAlias = new Map();
  for (const product of tracked) {
    for (const key of productNameKeys(product.name, invoice.supplier))
      matchesByName.set(key, [...(matchesByName.get(key) ?? []), product]);
    for (const alias of product.supplierAliases ?? [])
      matchesByAlias.set(alias.key, [
        ...(matchesByAlias.get(alias.key) ?? []),
        product,
      ]);
  }
  return {
    _id: fileHash,
    supplier: invoice.supplier,
    invoiceNumber: invoice.invoiceNumber,
    currency: invoice.currency,
    source: invoice.source,
    lines: invoice.lines.map((line, index) => {
      const linked =
        matchesByAlias.get(
          supplierAliasKey(invoice.supplier, line.description),
        ) ?? [];
      const matches = linked.length
        ? linked
        : (matchesByName.get(matchName(line.description)) ?? []);
      return {
        lineIndex: index,
        description: line.description,
        quantity: line.quantity,
        unitsPerPack: line.unitsPerPack,
        mode: line.mode,
        packPrice: line.packPrice,
        discountPercent: line.discountPercent,
        taxPercent: line.taxPercent,
        productId: matches.length === 1 ? String(matches[0]._id) : "",
        matchSource:
          matches.length > 1
            ? "ambiguous"
            : matches.length === 1
              ? linked.length
                ? "saved"
                : "name"
              : "unmatched",
        included: true,
      };
    }),
  };
}

export async function confirmInvoice(id, input, actorId) {
  if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id))
    throw new Problem("Huella de archivo inválida.");
  if (!input || typeof input !== "object")
    throw new Problem("Enviá los datos de la factura.");
  const supplier = text(input.supplier, "Proveedor", 150, true);
  const invoiceNumber = text(
    input.invoiceNumber,
    "Número de factura",
    80,
    true,
  );
  const invoiceKey = createHash("sha256")
    .update(invoiceIdentity(supplier, invoiceNumber))
    .digest("hex");
  const currency = text(input.currency ?? "", "Moneda", 3);
  if (
    !Array.isArray(input.entries) ||
    !input.entries.length ||
    input.entries.length > 200
  )
    throw new Problem("Seleccioná entre 1 y 200 renglones para ingresar.");
  const seen = new Set();
  const entries = input.entries.map((entry) => {
    if (!entry || typeof entry !== "object")
      throw new Problem("Renglón inválido.");
    const lineIndex = number(entry.lineIndex, "Renglón", 0, true, 199);
    if (seen.has(lineIndex))
      throw new Problem("Un renglón no puede ingresarse dos veces.");
    seen.add(lineIndex);
    if (typeof entry.productId !== "string" || !OwlIsValidId(entry.productId))
      throw new Problem("Seleccioná un producto existente.");
    if (!["units", "bottles", "ml"].includes(entry.mode))
      throw new Problem("Revisá la presentación de cada producto.");
    return {
      lineIndex,
      description:
        input.rememberMatches === false
          ? ""
          : text(entry.description, "Nombre del proveedor", 300, true),
      productId: entry.productId,
      purchasePrice:
        entry.purchasePrice == null
          ? null
          : number(entry.purchasePrice, "Precio de compra", 0),
      quantity: number(entry.quantity, "Cantidad", 1, true, 1000000),
      unitsPerPack: number(
        entry.unitsPerPack,
        "Unidades por paquete",
        1,
        true,
        10000,
      ),
      mode: entry.mode,
    };
  });
  try {
    return await OwlTransaction(async (session) => {
      if (await StockMovementModel.exists({ importKey: id }, { session }))
        return { _id: id, status: "confirmed", alreadyConfirmed: true };
      if (
        await StockMovementModel.exists(
          { importNumberKey: invoiceKey },
          { session },
        )
      )
        throw new Problem("Ese número de factura ya fue registrado.", 409);
      const products = await ProductModel.getByCoincidence(
        { _id: { $in: entries.map((entry) => entry.productId) }, active: true },
        { lean: true, select: "name bottleMl active supplierAliases", session },
      );
      const views = await productsWithInventory(products, session);
      if (
        input.updatePurchasePrices === true &&
        entries.some((entry) => entry.purchasePrice !== null)
      ) {
        const business = await BusinessModel.getOne(
          { key: "main" },
          { lean: true, select: "currency", session },
        );
        if (!currency || currency !== business?.currency)
          throw new Problem(
            "La moneda de la factura no coincide con la del negocio. Registrá solo existencias y revisá el costo por separado.",
          );
      }
      const byId = new Map(
        views.map((product) => [String(product._id), product]),
      );
      const saved = [];
      const newLinks = new Map();
      // All writes on this transaction are sequential, including repeated product lines.
      for (const entry of entries) {
        const product = byId.get(entry.productId);
        if (!product || product.inventory === "none")
          throw new Problem(
            "El producto no existe, está archivado o no lleva inventario.",
            409,
          );
        if (
          (product.inventory === "unit" && entry.mode !== "units") ||
          (product.inventory === "ml" && entry.mode === "units")
        )
          throw new Problem(
            `La presentación no coincide con el inventario de ${product.name}.`,
          );
        const delta =
          entry.quantity *
          entry.unitsPerPack *
          (entry.mode === "bottles" ? product.bottleMl : 1);
        number(delta, "Entrada de inventario", 1, true, 1e9);
        const stock = await changeStock(product, delta, session);
        if (input.rememberMatches !== false) {
          const name = entry.description
            .replace(/\b\d+(?:[.,]\d+)?\s*%/g, "")
            .trim();
          const key = supplierAliasKey(supplier, name);
          if (newLinks.has(key) && newLinks.get(key) !== entry.productId)
            throw new Problem(
              "El mismo nombre del proveedor no puede vincularse a dos productos.",
              409,
            );
          newLinks.set(key, entry.productId);
          if (!product.supplierAliases?.some((alias) => alias.key === key)) {
            const linked = await ProductModel.updateWhere(
              { _id: product._id, "supplierAliases.99": { $exists: false } },
              {
                $addToSet: {
                  supplierAliases: {
                    key,
                    supplier: invoiceIdentity(supplier, "alias").split(":")[0],
                    name,
                  },
                },
              },
              { session, runValidators: true },
            );
            if (!linked)
              throw new Problem(
                "Este producto alcanzó el máximo de 100 nombres de proveedor.",
                409,
              );
            product.supplierAliases = [
              ...(product.supplierAliases ?? []),
              { key, supplier, name },
            ];
          }
        }
        if (input.updatePurchasePrices === true && entry.purchasePrice !== null)
          await ProductModel.update(
            entry.productId,
            { $set: { purchasePrice: entry.purchasePrice } },
            { session, runValidators: true },
          );
        const first = saved.length === 0;
        saved.push({
          productId: entry.productId,
          delta,
          unit: stock.unit,
          balance: stock.stock,
        });
        await StockMovementModel.saveMany(
          [
            {
              productId: entry.productId,
              productName: product.name,
              delta,
              unit: stock.unit,
              reason: "Entrada de compra",
              balance: stock.stock,
              importGroup: id,
              ...(first ? { importKey: id, importNumberKey: invoiceKey } : {}),
              actorId,
            },
          ],
          { session },
        );
      }
      return {
        _id: id,
        status: "confirmed",
        alreadyConfirmed: false,
        entries: saved,
      };
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.["supplierAliases.key"])
      throw new Problem(
        "Ese nombre del proveedor ya está vinculado a otro producto. Revisá la coincidencia; no se modificó el inventario.",
        409,
      );
    if (
      error.code === 11000 &&
      (await StockMovementModel.exists({ importKey: id }))
    )
      return { _id: id, status: "confirmed", alreadyConfirmed: true };
    if (error.code === 11000)
      throw new Problem(
        "Ese número de factura ya fue registrado. No se volvió a sumar inventario.",
        409,
      );
    throw error;
  }
}
