import { Router } from "express";
import { createEventController } from "../../controllers/event/controller.js";

export function registerEvent(options = {}) {
  const router = Router();

  const controller = createEventController(options);
  router.post("/api/admin/events", controller.register);
  router.put("/api/admin/events/:id", controller.update);

  return router;
}

export default registerEvent;
