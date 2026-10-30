import { Router } from "express";
import { OwlRateLimit } from "owl-expressjs-utils";

import * as Controllers from "../../controllers/setup/controller.js";

export function registerInitialSetup(options = {}) {
  const router = Router();

  const { production, origin } = options;
  const controller = Controllers.createSetupController({ production, origin });
  router.get("/api/setup/status", controller.status);
  router.post(
    "/api/setup/admin",
    OwlRateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    controller.registerAdmin,
  );

  return router;
}

export default registerInitialSetup;
