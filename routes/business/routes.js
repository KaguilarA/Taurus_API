import { Router } from "express";
import { createBusinessController } from "../../controllers/business/controller.js";

export function registerBusiness(options = {}) {
  const router = Router();

  const controller = createBusinessController(options);
  router.put("/api/admin/settings", controller.update);
  router.get("/api/admin/seo", controller.readSeo);
  router.put("/api/admin/seo", controller.updateSeo);

  return router;
}

export default registerBusiness;
