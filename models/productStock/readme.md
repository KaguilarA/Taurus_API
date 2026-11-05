# ProductStock

Inventario canónico por producto, registrado una sola vez con `OwlModel`.

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `owner` | `ObjectId` | Requerido, único, referencia a `Product` |
| `unit` | `String` | Requerido: `unit` o `ml`; modo canónico del inventario |
| `stock` | `Number` | Entero seguro no negativo, requerido |
| `minimum` | `Number` | Entero seguro no negativo, predeterminado `0` |

Bebidas y snacks manejan unidades; botellas de licor, mililitros enteros. Las comidas no tienen registro de inventario. La capacidad de la botella pertenece a `Product.bottleMl`, no al saldo.

Todos los ajustes participan en transacciones OWL con sus movimientos y, cuando corresponde, pedidos o ventas. La migración conserva campos de origen y rechaza duplicados o saldos contradictorios.
