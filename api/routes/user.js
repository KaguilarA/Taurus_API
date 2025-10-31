import express from "express";
import validateAuthUser from "../../middlewares/auth.js";
import validateUserPermissions from "../../middlewares/permissions.js";
import UserController from "../controllers/user.js";

export default (model) => {
  const controller = new UserController(model);
  const router = express.Router();

  /**
   * @route GET /users
   * @description Gets all users
   * @access Public
   */
  router.get(
    "/",
    [validateAuthUser, validateUserPermissions],
    controller.getAll.bind(controller)
  );

  /**
   * @route GET /users/active
   * @description Gets all disabled users
   * @access Public
   */
  router.get(
    "/active",
    [validateAuthUser, validateUserPermissions],
    controller.getActive
  );

  /**
   * @route GET /users/disabled
   * @description Gets all disabled users
   * @access Public
   */
  router.get(
    "/disabled",
    [validateAuthUser, validateUserPermissions],
    controller.getDisabled
  );

  /**
   * @route GET /users/:id
   * @description Gets a user by ID
   * @access Public
   */
  router.get(
    "/:id",
    [validateAuthUser, validateUserPermissions],
    controller.getById
  );

  /**
   * @route POST /users
   * @description Creates a new user
   * @access Public
   */
  router.post("/", controller.register.bind(controller));

  /**
   * @route POST /users/validate-password
   * @description Validates a user's password
   * @access Public
   */
  router.post(
    "/validate",
    controller.validatePassword.bind(controller)
  );

  /**
   * @route PUT /users/:id
   * @description Update a user by ID
   * @access Public
   */
  router.put(
    "/:id",
    [validateAuthUser, validateUserPermissions],
    controller.updateUser
  );

  /**
   * @route PATCH /users/:id
   * @description Updates a user by ID
   * @access Public
   */
  router.patch(
    "/:id",
    [validateAuthUser, validateUserPermissions],
    controller.activateUser
  );

  /**
   * @route PUT /users/:id/password
   * @description Updates a user's password
   * @access Public
   */
  router.put(
    "/:id/password",
    [validateAuthUser, validateUserPermissions],
    controller.updatePassword
  );

  /**
   * @route DELETE /users/:id
   * @description Disables a user
   * @access Public
   */
  router.delete(
    "/:id",
    [validateAuthUser, validateUserPermissions],
    controller.disableUser
  );

  return router;
};
