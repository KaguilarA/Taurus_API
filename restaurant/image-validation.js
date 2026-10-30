import { Problem } from "./domain.js";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const imageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function validateImage(file) {
  if (!file) throw new Problem("Seleccioná una imagen.");
  const b = file.buffer;
  const detected =
    b.length >= 12 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "image/png"
      : b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255
        ? "image/jpeg"
        : b.length >= 12 &&
            b.toString("ascii", 0, 4) === "RIFF" &&
            b.toString("ascii", 8, 12) === "WEBP"
          ? "image/webp"
          : "";
  if (!detected || detected !== file.mimetype)
    throw new Problem("El archivo debe ser una imagen JPG, PNG o WebP válida.");
}
