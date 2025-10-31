import express from "express";
import validateAuthUser from "../../middlewares/auth.js";
import validateUserPermissions from "../../middlewares/permissions.js";
import BusinessController from "../controllers/business.js";

export default (model) => {
  const controller = new BusinessController(model);
  const router = express.Router();

  /**
   * @route POST /business/register
   * @description Register a new business
   */
  router.post(
    "/register",
    [validateAuthUser, validateUserPermissions],
    controller.register.bind(controller)
  );

  /**
   * @route GET /business/:businessId
   * @description Get business information by ID
   */
  router.get(
    "/:businessId",
    [validateAuthUser, validateUserPermissions],
    controller.getBusinessInfo.bind(controller)
  );

  return router;
};