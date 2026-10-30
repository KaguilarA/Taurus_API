import express from "express";
import validateAuthUser from "../../middlewares/auth.js";
import validateUserPermissions from "../../middlewares/permissions.js";
import StateController from "../controllers/state.js";

export default (model) => {
  const controller = new StateController(model);
  const router = express.Router();

  /**
   * @route GET /
   * @description Get all product types
   * @access Public
   */
  router.get(
    "/",
    [validateAuthUser, validateUserPermissions],
    controller.getAll.bind(controller)
  );

  /**
   * @route GET //menu-items
   * @description Get all product types
   * @access Public
   */
  router.get(
    "/business",
    [validateAuthUser, validateUserPermissions],
    controller.getBusinessStates.bind(controller)
  );

  /**
   * @route GET /cart
   * @description Get all cart states
   */
  router.get(
    "/carts",
    [validateAuthUser, validateUserPermissions],
    controller.getUsersStates.bind(controller)
  );

  /**
   * @route GET /menu-items
   * @description Get all product types
   * @access Public
   */
  router.get(
    "/menu-items",
    [validateAuthUser, validateUserPermissions],
    controller.getMenuItemsStates.bind(controller)
  );

  /**
   * @route GET /users
   * @description Get all product types
   * @access Public
   */
  router.get(
    "/users",
    [validateAuthUser, validateUserPermissions],
    controller.getUsersStates.bind(controller)
  );

  /**
   * @route POST /
   * @description Creates a new user
   * @access Public
   */
  router.post(
    "/",
    [validateAuthUser, validateUserPermissions],
    controller.register.bind(controller)
  );

  return router;
}
