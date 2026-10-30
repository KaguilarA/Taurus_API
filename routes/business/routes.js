import { Router } from "express";
import { createBusinessController } from "../../controllers/business/controller.js";

export function registerBusiness(options = {}) {
  const router = Router();

  const controller = createBusinessController(options);
  router.put("/api/admin/settings", controller.update);

  return router;
}

export default registerBusiness;
