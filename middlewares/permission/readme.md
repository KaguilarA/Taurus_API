# Permission Middleware

`permission.js` exports a factory that returns an Express middleware enforcing a named permission.

## Inputs

```js
const requirePermission = permissionMiddleware("state:register", {
	action: "state:register",
	actionMessage: "You do not have permission to create states.",
	permissionModel,
	userPermissionModel,
});
```

The factory accepts a permission name and optional configuration:

- `action`: action value exposed to later middleware; defaults to `access`.
- `actionMessage`: message returned for missing permission assignments.
- `permissionModel`: model used to look up the permission by name.
- `userPermissionModel`: model used to find the user-to-permission assignment.

When models are omitted, the middleware reads them from `req.app.locals`.

## Behavior

The middleware resolves the current user from `req.session.userId`, `req.user._id`, or `req.user.id`. It then verifies that the named permission exists and that the user has an assignment for it. Successful validation adds `req.permission`, `req.permissionName`, and `req.permissionAction`, then calls `next()`.

Missing authentication returns `401`. A missing permission or assignment returns `403`. Missing model configuration and unexpected failures return `500`.

## Related files

- `models/permission/model.js`: permission schema.
- `models/userPermission/model.js`: permission-assignment schema.
- `middlewares/actionLog/actionLog.js`: consumes request permission metadata when available.
