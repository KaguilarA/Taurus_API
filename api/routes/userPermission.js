import express from "express";
import validateAuthUser from "../../middlewares/auth.js";
import validateUserPermissions from "../../middlewares/permissions.js";
import UserPermissionController from "../controllers/userPermission.js";

export default (models) => {
  const controller = new UserPermissionController(models);
  const router = express.Router();
  const permissionMiddleware = (name) =>
    validateUserPermissions(name, models);

  router.get(
    "/:userId/permissions",
    [validateAuthUser, permissionMiddleware("PERMISSION_READ")],
    controller.list
  );
  router.post(
    "/:userId/permissions/:permissionId",
    [validateAuthUser, permissionMiddleware("PERMISSION_GRANT")],
    controller.grant
  );
  router.delete(
    "/:userId/permissions/:permissionId",
    [validateAuthUser, permissionMiddleware("PERMISSION_REVOKE")],
    controller.revoke
  );

  return router;
};