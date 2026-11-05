# Product

Producto vendible con nombre, descripción, imagen, precio, estado activo y destacado.

`productType` referencia el catálogo `ProductType`; `category` guarda su código para compatibilidad. Las categorías no están limitadas por un enum en código. La API deriva `inventory` desde `ProductStock.unit` (o `none` cuando no existe inventario); el modo debe coincidir con los permitidos del tipo.

Las botellas de licor (`liquor`, inventario `ml`) guardan capacidad en `bottleMl` y precios en `prices.shot`, `prices.small` y `prices.large`. La API acepta litros mediante `bottleLiters` y los convierte a mililitros enteros. Las medidas consumidas se configuran en `Business.servings`.

Saldo, mínimo y unidad pertenecen exclusivamente a `ProductStock`. Los valores antiguos se archivan en `legacyCatalog`; los campos `stock`, `minimum`, `inventory` y `type` se retiran del documento activo después de preservar su contenido. No se utilizan para vender o ajustar inventario. Las respuestas administrativas incluyen el saldo de `ProductStock`; la carta pública no lo expone.

`state` remains available for compatibility. Historical source values in `legacyCatalog` are read-only archives and are not operational inventory.
