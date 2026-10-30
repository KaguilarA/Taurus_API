import { Router } from "express";
import { createProductController } from "../../controllers/product/controller.js";

export function registerProduct(options = {}) {
  const router = Router();

  const controller = createProductController(options);
  router.post("/api/admin/products", controller.register);
  router.put("/api/admin/products/:id", controller.update);
  router.post("/api/admin/products/:id/stock", controller.adjustStock);

  return router;
}

export default registerProduct;
