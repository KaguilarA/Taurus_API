# Importación temporal de compras

En **Inventario → Cargar factura de compra**, un administrador sube PDF, JPG, PNG o WebP (hasta 10 MB), revisa coincidencias, paquetes, cantidades y costo neto, y confirma la entrada. Solo se actualizan productos existentes y sus saldos en `products` y `productstocks`; los precios de venta se conservan.

## Sin almacenamiento de facturas

El archivo se procesa únicamente en RAM y su buffer se limpia antes de terminar la solicitud. No se escriben PDF, imágenes, texto OCR, datos del cliente, borradores, números de factura ni desgloses en disco, base de datos, logs o servicios externos. El navegador mantiene la revisión en memoria de la página y la descarta al cerrar el panel o confirmar. No usa localStorage, IndexedDB ni cookies para la factura.

La lectura digital de Quimar usa pdf-parse. Las imágenes y PDF escaneados se reconocen con Tesseract en un proceso aislado, usando el modelo de idioma incluido en las dependencias; no descarga ni sube datos durante la lectura. No requiere claves externas. Se limita a un proceso simultáneo por instancia, 90 segundos, 20 páginas digitales o 3 escaneadas y 200.000 caracteres. Una lectura incompleta se rechaza para evitar entradas parciales.

Solo se conservan los resultados de negocio: saldo y costo del producto, movimientos de inventario con su responsable y las equivalencias de nombres solicitadas. Las equivalencias excluyen el porcentaje de descuento. En los movimientos quedan huellas SHA-256 del archivo y de proveedor/consecutivo para impedir duplicados; no contienen el documento ni su contenido y no permiten descargarlo o consultar una factura.

Al arrancar se descartan los borradores y datos de facturas de la implementación anterior. Si había compras confirmadas, primero se mantienen sus movimientos y sus huellas de deduplicación dentro de una transacción. No se borran productos, saldos, compras aplicadas, ventas, pagos ni usuarios.

## Contrato

- `POST /api/admin/products/invoices/preview`: multipart `invoice`; devuelve revisión efímera e `_id` (huella del archivo), sin escrituras en la base.
- `POST /api/admin/products/invoices/:id/confirm`: recibe `supplier`, `invoiceNumber`, `currency`, `updatePurchasePrices`, `rememberMatches` y `entries` (`lineIndex`, `description`, `productId`, `quantity`, `unitsPerPack`, `mode`, `purchasePrice`). La descripción se necesita solo para recordar equivalencias; el consecutivo solo se usa para calcular la huella.
- El administrador puede corregir los datos extraídos antes de confirmar. Toda entrada se valida y registra usando sus permisos de ajuste de inventario; no se confía en precios de venta del cliente.
- Máximos: 200 renglones, 2.000 productos activos y diez lecturas por IP cada quince minutos.
- `units`: unidades; `bottles`: botellas de licor convertidas con la capacidad actual; `ml`: mililitros. `1X12` significa doce unidades por paquete.

Una transacción OWL aplica stock, costo y equivalencias y registra los movimientos. Los índices únicos de las huellas impiden duplicados entre administradores y entre archivos distintos de la misma compra. Un reintento confirmado no vuelve a sumar existencias. Los renglones excluidos no se pueden agregar luego reutilizando el mismo consecutivo.

## Equivalencias y costo

`Product.supplierAliases` vincula cada nombre del proveedor con un producto (máximo 100 nombres por producto). Se proponen coincidencias únicas, incluyendo «Imperial Silver» → «Silver»; las ambiguas requieren selección manual. Un índice único rechaza vínculos contradictorios sin cambiar existencias. No se publican equivalencias en la carta.

`Product.purchasePrice` es costo por unidad o botella completa, después del descuento, sin IVA y en la moneda del negocio: `precioPaquete × (1 − descuento/100) / unidadesPorPaquete`, redondeado a cuatro decimales. Faltantes o moneda distinta no sobrescriben el costo. El campo no se expone en la carta pública.

## Validación

`npm test` comprueba lectura digital y OCR real de una imagen sintética sin datos privados, ausencia de borradores persistidos, limpieza de buffers y datos anteriores, permisos, equivalencias, rollback completo, privacidad de costos y confirmaciones/ventas concurrentes. El frontend comprueba revisión, recuperación de errores, descarte tras confirmar y navegación con teclado.
