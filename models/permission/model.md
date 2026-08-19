# Permission

Catálogo de permisos disponibles para autorización.

## Campos

| Campo | Tipo | Requerido | Reglas |
| --- | --- | --- | --- |
| `name` | `String` | Sí | Único, `trim`, máximo 50, patrón `[A-Z0-9_]+` |
| `description` | `String` | No | `trim`, máximo 255 caracteres |

El nombre debe usar únicamente letras mayúsculas, números y guiones bajos. Este modelo no declara relaciones con usuarios o roles.
