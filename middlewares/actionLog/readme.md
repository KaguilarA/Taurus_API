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

After the response finishes, the middleware attempts to save one entry containing the session user, resolved permission, action name, HTTP method, route template, permission name and final status code. Bodies, raw URLs, route values and query strings are excluded because they can contain passwords, bill tokens or invoice data. Custom metadata replaces the default metadata when `getMetadata` is supplied; callers must use an explicit allowlist of nonsensitive fields.

The middleware bypasses logging when no session user, action-log model, or resolvable permission exists. Persistence errors are reported to the server console and do not alter the response sent to the client.

## Response interception

This module subscribes once to the response `finish` event without wrapping response methods. Apply it before the handler that completes the response. Do not mount it more than once on the same route.
