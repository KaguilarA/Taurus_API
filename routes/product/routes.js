import { Router } from "express";
import {
  createProductController,
  createPublicProductController,
} from "../../controllers/product/controller.js";

export function registerProduct(options = {}) {
  const router = Router();

  const controller = createProductController(options);
  router.post("/api/admin/products", controller.register);
  router.put("/api/admin/products/:id", controller.update);
  router.post("/api/admin/products/:id/stock", controller.adjustStock);

  return router;
}

export default registerProduct;

export function publicProductRoutes() {
  const router = Router();
  const controller = createPublicProductController();
  router.get("/api/public/menu", controller.list);
  router.get("/api/public/menu/:id", controller.detail);
  return router;
}
