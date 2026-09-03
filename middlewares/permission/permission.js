export default (permissionName, options = {}) => {
  const {
    action = "access",
    actionMessage = "No tienes permisos para ejecutar esta acción.",
    permissionModel = null,
    userPermissionModel = null,
  } = options;

  return async function permissionMiddleware(req, res, next) {
    try {
      const userId = req.session?.userId || req.user?._id || req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "No autenticado." });
      }

      const effectivePermissionModel = permissionModel || req.app?.locals?.permissionModel || null;
      const effectiveUserPermissionModel = userPermissionModel || req.app?.locals?.userPermissionModel || null;

      if (!effectivePermissionModel || !effectiveUserPermissionModel) {
        return res.status(500).json({ message: "Configuración de permisos no disponible." });
      }

      const permissionDoc = await effectivePermissionModel.getOne({ name: permissionName });

      if (!permissionDoc) {
        return res.status(403).json({ message: `El permiso '${permissionName}' no existe.` });
      }

      const assignment = await effectiveUserPermissionModel.getOne({
        user: userId,
        permission: permissionDoc._id,
      });

      if (!assignment) {
        return res.status(403).json({ message: actionMessage });
      }

      req.permission = permissionDoc;
      req.permissionName = permissionName;
      req.permissionAction = action;

      return next();
    } catch (error) {
      console.error("Error validando permisos:", error);
      return res.status(500).json({ message: "Error validando permisos." });
    }
  };
};
