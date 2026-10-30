import { Router } from "express";
import { createPublicController } from "../../controllers/public/controller.js";

export function registerPublic(options = {}) {
  const router = Router();

  const controller = createPublicController({
    ...options,
    application: options.application,
  });
  router.get("/api/health", controller.health);
  router.get("/api/deployment", controller.deployment);
  router.get("/api/ready", controller.ready);
  router.get("/api/public", controller.menu);

  return router;
}

export function registerAdminState(options = {}) {
  const router = Router();

  const controller = createPublicController({
    ...options,
    application: options.application,
  });
  router.get("/api/admin/state", controller.workspace);

  return router;
}

export default registerPublic;
