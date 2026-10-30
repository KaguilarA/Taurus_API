import { Router } from "express";
import { allow } from "../../middlewares/access/access.js";
import { OwlRateLimit } from "owl-expressjs-utils";
import * as Controllers from "../../controllers/cart/controller.js";

export function publicOrdering(options = {}) {
  const router = Router();
  const { production, origin } = options;
  const controller = Controllers.createPublicOrderingController({
    production,
    origin,
  });
  const limiter = OwlRateLimit({ windowMs: 60000, limit: 30 });
  router.get("/api/public/accounts", limiter, controller.searchAccounts);
  router.get("/api/public/accounts/:id", limiter, controller.openAccount);
  router.post("/api/public/tables/:token/join", limiter, controller.join);
  router.get("/api/public/bills/:token", controller.getBill);
  router.get("/api/public/bills/:token/activity", controller.billActivity);
  router.post(
    "/api/public/bills/:token/orders",
    limiter,
    controller.placeOrder,
  );
  return router;
}

export function staffOrdering(options = {}) {
  const router = Router();
  const { production, origin } = options;
  const controller = Controllers.createStaffOrderingController({
    production,
    origin,
  });
  router.get("/api/admin/order-activity", controller.orderActivity);
  router.get("/api/admin/service", controller.service);
  router.patch("/api/admin/orders/:id", controller.updateOrder);
  router.post(
    "/api/admin/bills/:id/pay",
    allow("admin", "waiter"),
    controller.pay,
  );
  return router;
}
import { createCartController } from "../../controllers/cart/controller.js";

export function registerCart(options = {}) {
  const router = Router();
  const controller = createCartController(options);
  router.post("/api/admin/sales", controller.registerSale);
  router.post("/api/admin/sales/:id/void", controller.voidSale);
  router.get("/api/admin/reports", controller.reports);
  return router;
}

export default publicOrdering;
