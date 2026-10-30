import { Router } from "express";
import { createPromoController } from "../../controllers/promo/controller.js";

export function registerPromo(options = {}) {
  const router = Router();

  const controller = createPromoController(options);
  router.post("/api/admin/promotions", controller.register);
  router.put("/api/admin/promotions/:id", controller.update);

  return router;
}

export default registerPromo;
