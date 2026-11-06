export default ({
  actionLogModel,
  permissionModel,
  action = "action",
  getActionName,
  getMetadata,
  shouldRun = true,
}) =>
  function actionLogMiddlewareFn(req, res, next) {
    if (!shouldRun || !actionLogModel) {
      return next();
    }

    const userId = req.session?.userId;
    let permissionId = req.permission?._id || null;

    const resolveActionName = () => {
      if (typeof getActionName === "function") return getActionName(req, res);
      return req.permissionAction || action;
    };

    const resolveMetadata = () => {
      if (typeof getMetadata === "function") return getMetadata(req, res);
      return {
        method: req.method,
        route: req.route?.path ?? "unmatched",
        permission: req.permissionName || null,
      };
    };

    const recordLog = async (statusCode) => {
      try {
        if (!userId) return;

        if (!permissionId && permissionModel) {
          const permission = await permissionModel.getOne({
            name: resolveActionName(),
          });
          permissionId = permission?._id || null;
        }

        if (!permissionId) return;

        await actionLogModel.save({
          user: userId,
          permission: permissionId,
          action: resolveActionName(),
          metadata: {
            ...resolveMetadata(),
            statusCode,
          },
        });
      } catch {
        console.error("No se pudo registrar la acción.");
      }
    };

    res.once("finish", () => {
      recordLog(res.statusCode || 200).catch(() => {});
    });

    return next();
  };
