import actionLogMiddleware from "../actionLog/actionLog.js";

/**
 * Create a reusable action-log middleware for a configured route.
 * @param {{actionLogModel: Object, permissionModel?: Object}} dependencies - Models used by the middleware.
 * @param {string} action - Permission/action name recorded in the audit entry.
 * @returns {import('express').RequestHandler} Configured action-log middleware.
 */
export default(dependencies, action) =>
  actionLogMiddleware({
    ...dependencies,
    action,
  });
