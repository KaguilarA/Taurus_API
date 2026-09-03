# Action Log Middleware

`actionLog.js` exports a configurable Express middleware factory for recording completed route actions.

## Configuration

The factory accepts an object with these fields:

| Field | Description |
| --- | --- |
| `actionLogModel` | Model that persists audit records. Required to write a log. |
| `permissionModel` | Optional fallback model for resolving a permission by action name. |
| `action` | Default action name when no request permission action is available. |
| `getActionName` | Optional callback that derives the action from the request and response. |
| `getMetadata` | Optional callback that derives custom audit metadata. |
| `shouldRun` | Set to `false` to bypass auditing. |

## Recorded data

After `res.json`, `res.send`, or `res.end` completes, the middleware attempts to save an entry containing the session user, resolved permission, action name, HTTP method, URL, body, route parameters, query parameters, and final status code. Custom metadata replaces the default metadata when `getMetadata` is supplied.

The middleware bypasses logging when no session user, action-log model, or resolvable permission exists. Persistence errors are reported to the server console and do not alter the response sent to the client.

## Response interception

This module wraps Express response methods before calling `next()`. Apply it before the handler that completes the response. Do not mount it more than once on the same route, or a single response can be audited multiple times.
