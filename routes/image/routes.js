import { Router } from "express";
import multer from "multer";

import { OwlRateLimit } from "owl-expressjs-utils";
import { Problem } from "../../services/validation.js";
import {
  MAX_IMAGE_BYTES,
  imageMimeTypes as mimeTypes,
} from "../../services/image-validation.js";

const purposes = new Set(["product", "promotion", "event", "branding"]);
import * as Controllers from "../../controllers/image/controller.js";

export function registerImageUploads(options = {}) {
  const router = Router();
  const { uploadImage = Controllers.uploadOptimizedImage } = options;

  const { production, origin } = options;
  const controller = Controllers.createImageController({
    production,
    uploadImage,
  });
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
  router.post(
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
    controller.upload,
  );

  return router;
}

export default registerImageUploads;
