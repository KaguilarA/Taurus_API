import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Problem, text, number } from "./validation.js";
import { validateImage } from "./image-validation.js";

export const MAX_INVOICE_BYTES = 10 * 1024 * 1024;
export const MAX_INVOICE_LINES = 200;
export const invoiceMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function validateInvoiceFile(file) {
  if (!file?.buffer?.length)
    throw new Problem("Seleccioná una factura PDF o una imagen.");
  if (file.buffer.length > MAX_INVOICE_BYTES)
    throw new Problem("La factura no puede superar 10 MB.", 413);
  if (file.mimetype === "application/pdf") {
    if (!/^%PDF-\d\.\d/.test(file.buffer.toString("ascii", 0, 8)))
      throw new Problem("El archivo no es un PDF válido.");
  } else validateImage(file);
}

export function validateInvoiceReading(value) {
  if (
    !value ||
    !Array.isArray(value.lines) ||
    !value.lines.length ||
    value.lines.length > MAX_INVOICE_LINES
  )
    throw new Problem(
      "No se pudo leer una factura completa de hasta 200 renglones.",
      422,
    );
  const currency = text(value.currency ?? "", "Moneda", 3).toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency))
    throw new Problem("Moneda de factura inválida.", 422);
  return {
    supplier: text(value.supplier, "Proveedor", 150, true),
    invoiceNumber: text(value.invoiceNumber ?? "", "Número de factura", 80),
    currency,
    lines: value.lines.map((line) => ({
      description: text(line.description, "Descripción", 300, true),
      quantity:
        line.quantity === null
          ? null
          : number(line.quantity, "Cantidad", 0.001, false, 1000000),
      unitsPerPack:
        line.unitsPerPack === null
          ? null
          : number(line.unitsPerPack, "Unidades por paquete", 1, true, 10000),
      mode: ["units", "bottles", "ml", ""].includes(line.mode) ? line.mode : "",
      packPrice:
        line.packPrice == null
          ? null
          : number(line.packPrice, "Precio de compra del paquete", 0),
      discountPercent:
        line.discountPercent == null
          ? null
          : number(line.discountPercent, "Descuento", 0, false, 100),
      taxPercent:
        line.taxPercent == null
          ? null
          : number(line.taxPercent, "IVA", 0, false, 100),
    })),
  };
}

// Conservative parser for the digital Quimar layout. Scanned documents use offline OCR.
export function parseQuimarText(content, { ocr = false } = {}) {
  if (!(ocr ? /QUIMAR/i : /DISTRIBUIDORA\s+QUIMAR\s+LA\s+FILA/i).test(content))
    return null;
  const key = content.match(/\b506\d{47}\b/)?.[0];
  const invoiceNumber = key?.slice(21, 41);
  if (!invoiceNumber && !ocr) return null;
  const lines = [];
  for (const row of content.split(/\r?\n/)) {
    const match = row
      .trim()
      .match(
        /^(\d+\.\d{2})\s+(.+?)\s+(\d+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/,
      );
    if (!match && /^\d+\.\d{2}\s+[A-Za-zÁ-ú]/.test(row.trim())) return null;
    if (!match) continue;
    const pack = match[2].match(/\b1\s*[xX]\s*(\d+)\b/);
    // Do not infer a package size or an inventory unit when it is absent.
    const discount = match[2].match(/(\d+(?:\.\d+)?)\s*%/);
    lines.push({
      description: match[2],
      quantity: Number(match[1]),
      unitsPerPack: pack ? Number(pack[1]) : null,
      mode: pack ? "units" : "",
      packPrice: Number(match[4].replaceAll(",", "")),
      discountPercent: discount ? Number(discount[1]) : null,
      taxPercent: Number(match[3]),
    });
  }
  if (!lines.length) return null;
  const currency = content.match(/\b(CRC|USD|EUR)\b/)?.[1] ?? "";
  return validateInvoiceReading({
    supplier: "DISTRIBUIDORA QUIMAR LA FILA S.A",
    invoiceNumber,
    currency,
    lines,
  });
}

let activeReads = 0;
export async function readInvoice(file) {
  validateInvoiceFile(file);
  if (activeReads >= 1)
    throw new Problem(
      "Hay otra factura procesándose. Intentá de nuevo en un momento.",
      503,
    );
  activeReads++;
  try {
    return await new Promise((resolve, reject) => {
      const worker = fork(
        fileURLToPath(new URL("./invoice-pdf-worker.js", import.meta.url)),
        [],
        {
          execArgv: ["--max-old-space-size=192"],
          serialization: "advanced",
          windowsHide: true,
          stdio: ["ignore", "ignore", "ignore", "ipc"],
        },
      );
      const timer = setTimeout(() => {
        worker.kill();
        reject(
          new Problem(
            "La lectura tardó demasiado. Usá una factura más pequeña o una foto más clara.",
            422,
          ),
        );
      }, 90000);
      worker.once("message", (result) => {
        clearTimeout(timer);
        worker.kill();
        result.error
          ? reject(new Problem(result.error, 422))
          : resolve(result.reading);
      });
      worker.once("error", () => {
        clearTimeout(timer);
        reject(new Problem("No se pudo abrir la factura.", 422));
      });
      worker.once("exit", () => {
        clearTimeout(timer);
        reject(new Problem("No se pudo procesar la factura.", 422));
      });
      worker.send({ buffer: file.buffer, mimetype: file.mimetype });
    });
  } finally {
    activeReads--;
  }
}
