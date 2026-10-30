import { Router } from "express";
import { createTableController } from "../../controllers/table/controller.js";
export function registerTables(options = {}) {
  const router = Router();

  const controller = createTableController(options);
  router.get("/api/admin/tables", controller.getTables);
  router.post("/api/admin/tables", controller.registerTable);
  router.patch("/api/admin/tables/:id", controller.updateTable);

  return router;
}

export default registerTables;
