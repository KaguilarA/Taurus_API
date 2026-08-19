# ProductType

Catálogo de tipos o categorías asignables a productos.

## Campos

| Campo | Tipo | Requerido | Reglas |
| --- | --- | --- | --- |
| `name` | `String` | Sí | `trim`, único, máximo 100 caracteres |
| `description` | `String` | No | `trim` |

Los productos apuntan a este catálogo mediante el array `Product.type`.
