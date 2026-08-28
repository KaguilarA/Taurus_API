# User

Representa una cuenta de usuario.

## Campos

| Campo | Tipo | Requerido | Reglas |
| --- | --- | --- | --- |
| `name` | `String` | Sí | `trim`, máximo 100 caracteres |
| `lastname` | `String` | Sí | `trim`, máximo 100 caracteres |
| `password` | `String` | Sí | Se excluye del resultado del modelo mediante `OwlModel` |
| `state` | `ObjectId` | Sí | Referencia a `State` |

La contraseña sigue siendo obligatoria al guardar, pero no se expone en los resultados generados por el modelo. El esquema no define aquí hashing ni validación de complejidad.

## Relaciones

- Cada `User` requiere un `State`.
- Puede ser propietario de `Email`, `Phone` e `Image` mediante referencias polimórficas.
- Puede tener `Cart` asociados.
- Puede tener permisos activos mediante `UserPermission`.

