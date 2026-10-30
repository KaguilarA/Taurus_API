import express from "express";
import validateAuthUser from "../../middlewares/auth.js";
import validateUserPermissions from "../../middlewares/permissions.js";
import PermissionController from "../controllers/permission.js";

export default (model) => {
  const controller = new PermissionController(model);
  const router = express.Router();

  /**
   * @route GET /product-types
   * @description Get all product types
   */
  router.get(
    "/",
    [validateAuthUser, validateUserPermissions],
    controller.getAll
  );

  /**
   * @route POST /users
   * @description Creates a product type
   */
  router.post(
    "/",
    [validateAuthUser, validateUserPermissions],
    controller.register
  );

  return router;
}