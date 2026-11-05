# ProductType

Catálogo dinámico referenciado mediante `Product.productType`.

| Campo | Tipo | Uso |
| --- | --- | --- |
| `code` | `String` | Código único e inmutable; también se publica como `Product.category` |
| `name` | `String` | Nombre único, requerido, hasta 100 caracteres |
| `description` | `String` | Descripción opcional |
| `inventoryModes` | `String[]` | Modos permitidos: `none`, `unit`, `ml` |
| `requiresDrinkType` | `Boolean` | Exige subcategoría de bebida |
| `kitchen` | `Boolean` | Los nuevos pedidos requieren cocina |
| `active` | `Boolean` | Desactivarlo oculta sus productos e impide nuevos pedidos |
| `revision` | `Number` | Serializa cambios de política y altas/ediciones de productos |

Tipos iniciales: `food` (sin inventario), `drink` y `snack` (unidades), `liquor` (mililitros). Solo `liquor` permite shot, trago pequeño o grande. El administrador puede crear tipos adicionales, editar opciones o archivarlos. Los cambios incompatibles con productos existentes se rechazan; el historial no se modifica.
