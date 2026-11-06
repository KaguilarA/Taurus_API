import { Router } from "express";
import multer from "multer";
import { OwlRateLimit } from "owl-expressjs-utils";
import { createInvoiceController } from "../../controllers/product/invoices.js";
import {
  MAX_INVOICE_BYTES,
  invoiceMimeTypes,
} from "../../services/invoice-reading.js";
import { Problem } from "../../services/validation.js";
import {
  createProductController,
  createPublicProductController,
} from "../../controllers/product/controller.js";

export function registerProduct(options = {}) {
  const router = Router();

  const controller = createProductController(options);
  const invoices = createInvoiceController(options);
  const multipart = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_INVOICE_BYTES, files: 1, fields: 0, parts: 1 },
    fileFilter(req, file, done) {
      const valid = invoiceMimeTypes.has(file.mimetype);
      done(valid ? null : new Problem("Usá PDF, JPG, PNG o WebP."), valid);
    },
  }).single("invoice");
  router.post(
    "/api/admin/products/invoices/preview",
    OwlRateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    (req, res, next) =>
      multipart(req, res, (error) => {
        if (error instanceof multer.MulterError)
          return next(
            new Problem(
              error.code === "LIMIT_FILE_SIZE"
                ? "La factura no puede superar 10 MB."
                : "Enviá una sola factura en el campo invoice.",
              error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
            ),
          );
        next(error);
      }),
    invoices.preview,
  );
  router.post("/api/admin/products/invoices/:id/confirm", invoices.confirm);
  router.get("/api/admin/product-types", controller.listTypes);
  router.post("/api/admin/product-types", controller.registerType);
  router.put("/api/admin/product-types/:id", controller.updateType);
  router.post("/api/admin/products", controller.register);
  router.put("/api/admin/products/:id", controller.update);
  router.post("/api/admin/products/:id/stock", controller.adjustStock);

  return router;
}

export default registerProduct;

export function publicProductRoutes() {
  const router = Router();
  const controller = createPublicProductController();
  router.get("/api/public/product-types", controller.types);
  router.get("/api/public/menu", controller.list);
  router.get("/api/public/menu/:id", controller.detail);
  return router;
}
