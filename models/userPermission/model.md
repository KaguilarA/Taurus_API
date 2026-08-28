# UserPermission

Relaciona un usuario con un permiso y conserva el historial de revocación.

| Campo | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `user` | `ObjectId` | Sí | Referencia a `User` |
| `permission` | `ObjectId` | Sí | Referencia a `Permission` |

Una relación está activa cuando `revokedAt` no existe. La aplicación debe impedir duplicados activos para la pareja `user` + `permission`.