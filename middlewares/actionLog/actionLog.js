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
        url: req.originalUrl || req.url,
        body: req.body || {},
        params: req.params || {},
        query: req.query || {},
        permission: req.permissionName || null,
      };
    };

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalEnd = res.end.bind(res);

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
      } catch (error) {
        console.error("Error registrando action log:", error);
      }
    };

    res.json = async function jsonWithLog(body) {
      const result = await originalJson(body);
      await recordLog(res.statusCode || 200);
      return result;
    };

    res.send = async function sendWithLog(body) {
      const result = await originalSend(body);
      await recordLog(res.statusCode || 200);
      return result;
    };

    res.end = async function endWithLog(chunk, encoding) {
      const result = await originalEnd(chunk, encoding);
      await recordLog(res.statusCode || 200);
      return result;
    };

    return next();
  };
