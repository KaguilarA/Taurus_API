import { Router } from "express";
import { OwlRateLimit } from "owl-expressjs-utils";

import * as Controllers from "../../controllers/auth/controller.js";
export function registerRecovery(options = {}) {
  const router = Router();

  const { production, origin } = options;
  const controller = Controllers.createRecoveryController({
    production,
    origin,
  });
  router.post(
    "/api/auth/reset/request",
    OwlRateLimit({ windowMs: 900000, limit: 5 }),
    controller.requestReset,
  );
  router.get("/api/auth/reset/status", controller.resetStatus);
  router.post(
    "/api/auth/reset/complete",
    OwlRateLimit({ windowMs: 900000, limit: 10 }),
    controller.completeReset,
  );

  return router;
}

import { createAuthController } from "../../controllers/auth/controller.js";

export function registerAuth(options = {}) {
  const router = Router();

  const controller = createAuthController(options);
  router.get("/api/auth/status", controller.status);
  router.post(
    "/api/auth/login",
    OwlRateLimit({ windowMs: 900000, limit: 10 }),
    controller.logIn,
  );
  router.post("/api/auth/logout", controller.logout);

  return router;
}

export default registerAuth;
