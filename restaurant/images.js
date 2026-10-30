import { randomUUID } from "node:crypto";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { OwlRateLimit } from "owl-expressjs-utils";
import { Problem } from "./domain.js";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const purposes = new Set(["product", "promotion", "event", "branding"]);
const mimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function cloudinaryOptions(env = process.env) {
  let cloud_name = env.CLOUDINARY_CLOUD_NAME;
  let api_key = env.CLOUDINARY_API_KEY;
  let api_secret = env.CLOUDINARY_API_SECRET;
  if (env.CLOUDINARY_URL) {
    try {
      const url = new URL(env.CLOUDINARY_URL);
      if (url.protocol !== "cloudinary:") throw new Error();
      cloud_name = url.hostname;
      api_key = decodeURIComponent(url.username);
      api_secret = decodeURIComponent(url.password);
    } catch {
      throw new Problem(
        "Cloudinary no está configurado correctamente en el servidor.",
        503,
      );
    }
  }
  const folder = env.CLOUDINARY_FOLDER;
  if (
    !cloud_name ||
    !api_key ||
    !api_secret ||
    !folder ||
    !/^[a-zA-Z0-9/_-]+$/.test(folder)
  )
    throw new Problem(
      "Configurá las credenciales de Cloudinary en el entorno del backend.",
      503,
    );
  return { cloud_name, api_key, api_secret, folder, secure: true };
}

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

export async function uploadCloudinaryImage(file, purpose) {
  const options = cloudinaryOptions();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        ...options,
        folder: `${options.folder}/${purpose}`,
        public_id: randomUUID(),
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        overwrite: false,
        timeout: 60000,
      },
      (error, result) => {
        if (error || !result?.secure_url?.startsWith("https://"))
          return reject(
            new Problem("No se pudo subir la imagen. Intentá de nuevo.", 502),
          );
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
        });
      },
    );
    stream.on("error", () =>
      reject(new Problem("No se pudo subir la imagen. Intentá de nuevo.", 502)),
    );
    stream.end(file.buffer);
  });
}

export function registerImageUploads(
  app,
  { uploadImage = uploadCloudinaryImage } = {},
) {
  const multipart = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 1 },
    fileFilter(req, file, done) {
      done(
        mimeTypes.has(file.mimetype)
          ? null
          : new Problem("Usá una imagen JPG, PNG o WebP."),
        mimeTypes.has(file.mimetype),
      );
    },
  }).single("image");
  app.post(
    "/api/admin/images",
    (req, res, next) =>
      (req.account.role ?? "admin") === "admin"
        ? next()
        : next(new Problem("Solo un administrador puede subir imágenes.", 403)),
    OwlRateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    (req, res, next) => {
      if (!purposes.has(req.query.purpose))
        return next(new Problem("Destino de imagen inválido."));
      multipart(req, res, (error) => {
        if (!error) return next();
        if (error instanceof multer.MulterError)
          return next(
            new Problem(
              error.code === "LIMIT_FILE_SIZE"
                ? "La imagen no puede superar 5 MB."
                : "Enviá una sola imagen en el campo image.",
              error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
            ),
          );
        next(error);
      });
    },
    async (req, res) => {
      validateImage(req.file);
      res.status(201).json(await uploadImage(req.file, req.query.purpose));
    },
  );
}
