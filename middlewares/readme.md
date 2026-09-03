# Middleware

Middleware establishes cross-cutting behavior at the HTTP boundary. Feature routers compose these factories with authentication from `owl-expressjs-utils` before invoking controllers.

## Available middleware

| Module | Responsibility |
| --- | --- |
| `permission/permission.js` | Validates that the authenticated user has a named permission assignment. |
| `actionLog/actionLog.js` | Records a completed response as an action-log entry. |
| `recordLog/recordLog.js` | Adapts the action-log factory for routes with a fixed action name. |

## Composition order

For a protected write operation, apply middleware in this order:

1. `OwlIsAuth` validates the session.
2. Permission middleware resolves and validates the requested permission.
3. Action-log middleware captures response metadata.
4. The route handler sends the response.

The order matters: the action log can reuse permission metadata placed on the request, and unauthenticated or unauthorized requests are not recorded as successful domain actions.

## Error behavior

Permission failures respond with `401`, `403`, or `500` and do not call the next handler. Audit-log failures are logged to the server console but never replace an already generated HTTP response.
