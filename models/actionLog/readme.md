# ActionLog Model

## Responsibility

Stores an audit record after a permission-aware request reaches a response method.

## Fields

| Field | Rules |
| --- | --- |
| `user` | Required indexed `ObjectId` reference to `User`. |
| `permission` | Required indexed `ObjectId` reference to `Permission`. |
| `action` | Required trimmed string. |
| `metadata` | Object with an empty-object default. Stores request details and status code. |

## Lifecycle

`actionLogMiddleware` creates records after `res.json` or `res.send` is called. The model itself does not create audit records automatically.

## Limitations

There is no retention policy, immutable database rule, or dedicated ownership filter in the schema.

## Implementation

- Schema data: `models/actionLog/model.js`
- Instantiation: `models/models.js`
- HTTP routes: `routes/actionLog/routes.js`
