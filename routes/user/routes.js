import { Router } from "express";
import { OwlRateLimit } from "owl-expressjs-utils";

import { Problem } from "../../services/validation.js";

import * as Controllers from "../../controllers/user/controller.js";

export function registerProfile(options = {}) {
  const router = Router();

  const { production, origin } = options;
  const controller = Controllers.createUserController({ production, origin });
  router.get("/api/admin/me", controller.getInfo);
  router.put("/api/admin/me", controller.update);
  router.put(
    "/api/admin/me/password",
    OwlRateLimit({ windowMs: 900000, limit: 10 }),
    controller.changePassword,
  );
  const admin = (req, res, next) =>
    (req.account.role ?? "admin") === "admin"
      ? next()
      : next(new Problem("Acceso restringido.", 403));
  router.get("/api/admin/password-resets", admin, controller.getPasswordResets);
  router.patch(
    "/api/admin/password-resets/:id",
    admin,
    controller.decidePasswordReset,
  );

  return router;
}

export function registerAccounts(options = {}) {
  const router = Router();

  const controller = Controllers.createAccountsController(options);
  router.get("/api/admin/accounts", controller.getAccounts);
  router.post("/api/admin/accounts", controller.registerAccount);

  return router;
}

export default registerProfile;
