# Facturas de compra y costo de inventario

En **Inventario → Cargar factura de compra**, un administrador sube un PDF, JPG, PNG o WebP (hasta 10 MB). La revisión muestra renglones, coincidencias con productos existentes, cantidad de paquetes, unidades por paquete y entrada resultante. Corregir o excluir los renglones sin coincidencia o presentación antes de confirmar. No se crean productos ni se modifican precios de venta. Un `1X12` significa doce unidades por paquete.

Los PDF digitales con el formato reconocido de Distribuidora Quimar se leen localmente, en un proceso aislado (máximo 20 páginas, 200.000 caracteres y 15 segundos). Si cambia el formato, o el documento es una foto/escaneo, el backend usa Responses de OpenAI. Configurar `OPENAI_API_KEY` e `INVOICE_OCR_MODEL` solo en el servidor; el modelo debe soportar imágenes, PDF y salida estructurada. Sin estas variables se conserva la lectura local de Quimar y se informa que falta configurar el reconocimiento de imágenes. Las facturas enviadas al proveedor usan `store: false`; no se envía el catálogo. No se conserva el archivo original ni se publica en Cloudinary. Referencias: [archivos en Responses](https://developers.openai.com/api/docs/guides/file-inputs) y [pdf-parse](https://github.com/mehmet-kozan/pdf-parse).

## Contrato

- `POST /api/admin/products/invoices/preview` recibe multipart `invoice` y guarda un borrador con los datos extraídos, sin tocar existencias.
- `POST /api/admin/products/invoices/:id/confirm` recibe `supplier`, `invoiceNumber`, `updatePurchasePrices`, `rememberMatches` (por defecto verdadero) y `entries` (`lineIndex`, `productId`, `quantity`, `unitsPerPack`, `mode`, `purchasePrice`).
- `mode` admite `units`, `bottles` o `ml`; las botellas se convierten usando la capacidad actual del producto.
- Se admiten hasta 200 renglones y 2.000 productos activos. La lectura está limitada a diez intentos por IP cada quince minutos y dos procesos PDF simultáneos por instancia.

Una sola transacción OWL actualiza saldos, costos seleccionados, factura y movimientos con administrador responsable. Los índices únicos de hash de archivo y proveedor/número impiden duplicados, incluso entre archivos diferentes o administradores concurrentes. Reiniciar la API tras desplegar crea estos índices aditivos. Los reintentos del mismo borrador confirmado devuelven el resultado previo. Los renglones excluidos no pueden añadirse después con el mismo número: revisar toda la factura antes de confirmarla.

## Equivalencias de nombres

Cada producto guarda sus nombres de proveedor en `Product.supplierAliases`; no existe otro registro de productos. La revisión propone coincidencias únicas (incluyendo variantes de Quimar como «Imperial Silver» → «Silver») y marca las ambiguas para selección manual. Al confirmar con «Recordar la relación», el nombre original se vincula al ID del producto. Un nombre del mismo proveedor no puede pertenecer a dos productos: un índice único y la transacción rechazan el conflicto sin modificar stock ni costos. Los descuentos no forman parte de la identidad del nombre; la presentación y el tamaño del paquete sí. Cada producto admite hasta 100 equivalencias. Las equivalencias no se publican en la carta. Desactivar la casilla permite registrar una compra sin guardar nuevos vínculos.

## Precio de compra neto

`Product.purchasePrice` es un costo opcional por unidad o botella completa, después de descuento y **sin IVA**, en la moneda del negocio. El formulario permite editarlo, Inventario lo muestra y la factura puede actualizarlo calculando `precioPaquete × (1 − descuento/100) / unidadesPorPaquete`, redondeado a cuatro decimales. La presentación monetaria usa dos decimales.

Un precio/descuento ilegible no sobrescribe el costo anterior. La importación en otra moneda permite cargar existencias, pero bloquea la actualización de costos. Este campo no se expone en la carta pública. No se recalculan ventas ni márgenes históricos. La factura conserva los valores extraídos y las entradas confirmadas; la edición de costos en productos no altera facturas anteriores.

## Validación

`npm test` incluye lectura de un PDF sintético sin datos privados, equivalencias de paquetes y botellas, permisos, rollback completo, costos privados, dos confirmaciones concurrentes del mismo borrador y dos archivos con el mismo número. Las llamadas OCR se simulan en pruebas; la exactitud de fotos requiere probar con el proveedor configurado. En el frontend, las pruebas cubren revisión, errores/reintentos, bloqueo de entradas incompatibles y apertura del selector con teclado.
