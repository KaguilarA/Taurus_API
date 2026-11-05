# Product

Producto vendible con nombre, descripción, imagen, precio, estado activo y destacado.

`productType` referencia el catálogo `ProductType`; `category` guarda su código para compatibilidad. Las categorías no están limitadas por un enum en código. `inventory` debe coincidir con los modos permitidos del tipo.

Las botellas de licor (`liquor`, inventario `ml`) guardan capacidad en `bottleMl` y precios en `prices.shot`, `prices.small` y `prices.large`. La API acepta litros mediante `bottleLiters` y los convierte a mililitros enteros. Las medidas consumidas se configuran en `Business.servings`.

Saldo y mínimo pertenecen exclusivamente a `ProductStock`. Los valores antiguos se archivan en `legacyCatalog`; los campos `stock`, `minimum` y `type` se retiran del documento activo después de preservar su contenido. No se utilizan para vender o ajustar inventario. Las respuestas administrativas incluyen el saldo de `ProductStock`; la carta pública no lo expone.

`state` se conserva por compatibilidad. El array histórico `type` se migra a una referencia única; referencias múltiples o contradicciones detienen la migración.
