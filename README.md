# Taurus · API para bares y restaurantes

Backend Express 5 con MongoDB y `owl-expressjs-utils` 1.0.3. El frontend Angular se encuentra en `../taurus-ng-fe`.

## Primer arranque

Requiere Node.js 24, npm 12 y MongoDB Atlas o un replica set local. Copiá `.env.example` a `.env` y configurá conexión, nombre de base, origen del frontend y secreto de sesión. Ejecutá `npm ci` y `npm start` (o `npm run dev`). El frontend se inicia con `npm start` en su repositorio.

Sin administrador, la aplicación abre `/setup`. Después de registrarlo con usuario y contraseña de al menos 12 caracteres, abre `/business/setup` para completar la información del negocio. Los guards verifican el estado en el servidor; el registro inicial queda cerrado cuando existe un administrador. No se crean usuarios desde variables ADMIN_* ni se cargan catálogos o marcas de ejemplo al arrancar.

Nombre, subtítulo, textos, imágenes, contacto, moneda, color y medidas se guardan en el modelo **Business**, colección `businesses`. Si existe un perfil anterior en `restaurantsettings`, se copia conservando el original y sus valores. Si existen varios negocios antiguos, configurá `BUSINESS_ID` para elegir uno. La instalación sigue siendo para un solo negocio.

Para MongoDB local, configurá las variables LOCAL_MONGO_* del ejemplo y usá `npm run db:start` / `npm run db:stop`. La conexión siempre viene del entorno. Las pruebas usan bases temporales separadas y no alteran tu base.

## Qué incluye

- Carta pública con comidas, bebidas, snacks y botanas, precios por tamaño y promociones activas por fecha. Comidas y snacks no descuentan inventario.
- Pedidos sin autenticación desde un QR por mesa o posición; cuenta compartida, notas y seguimiento en tiempo real.
- Panel de pedidos con preparación para cocina y entrega/cobro para meseros. Los permisos se verifican también en la API.
- Registro de pagos en efectivo, SIMPE o tarjeta, con referencia opcional, fecha y persona que recibió el pago.
- Productos editables, archivado y destacados. Las comidas no tienen inventario.
- Bebidas por unidad o por mililitros. El stock se almacena en unidades enteras o ml enteros, nunca como botellas fraccionadas.
- Contenido de botella configurable por producto; medidas globales de trago grande, pequeño y shot.
- Reposiciones, salidas y mermas con motivo y saldo posterior. Los productos nuevos empiezan en cero; se cargan desde Inventario.
- Ventas mixtas atómicas: si una línea no tiene saldo, no se registra ninguna parte de la venta. Los precios se calculan en el servidor.
- Clave de idempotencia `requestId`: reintentar una confirmación devuelve la venta original sin descontar dos veces. Usar una clave distinta para cada orden nueva.
- Anulación de ventas con devolución de inventario exactamente una vez.
- Reportes de comidas y bebidas ordenados por cantidad vendida, ingresos y período. El frontend exporta CSV.
- Nombre, textos, moneda, color, imágenes, dirección, horario y medidas editables desde Personalización.

Los precios se consideran precios finales. El punto de venta registra ventas pagadas; los pedidos por QR quedan pendientes hasta registrar su pago. El sistema registra el medio utilizado, pero no verifica transferencias SIMPE ni ejecuta cargos de tarjeta. No integra pasarelas, facturación electrónica, cálculo fiscal ni reservas. Las promociones son anuncios con condiciones escritas; no aplican descuentos automáticos al punto de venta. No hay recetas de cócteles con múltiples ingredientes. Cada instalación corresponde a un negocio; no es una plataforma multiempresa.

## Atención por QR

1. Configurá el nombre del negocio en **Personalización** y creá los accesos del personal en **Equipo y roles**.
2. Configurá `FRONTEND_URL` con el origen HTTPS público del frontend, accesible desde los celulares. En desarrollo el QR apunta a localhost, por lo que solo sirve en la misma computadora. Publicá frontend y API bajo el mismo origen antes de imprimir los QR.
3. En **Mesas y códigos QR**, creá cada mesa o posición (por ejemplo, Mesa 04 o Barra 02) y descargá su QR PNG. Pausar la mesa impide nuevos pedidos, pero permite terminar y cobrar los existentes.
4. El cliente escanea el QR: ve la carta, agrega comidas/bebidas/snacks y confirma su pedido. Otros dispositivos que escanean el mismo QR comparten la cuenta abierta. El navegador recuerda la visita; no se requiere correo, contraseña ni registro.
5. **Cocina** cambia recibido → en preparación → listo. **Mesero** cambia listo → entregado y registra el pago total de la cuenta. **Administrador** puede realizar todas estas operaciones.
6. El cliente ve pedidos, estados, total y saldo. Al registrar el pago, el saldo pasa a cero y el QR permite iniciar otra visita con una cuenta nueva; no incorpora pedidos anteriores.

Los precios se calculan en el servidor y el inventario se reserva al recibir el pedido. Reintentos con el mismo `requestId` dentro de una cuenta no duplican órdenes ni descuentan stock dos veces. Cobrar y agregar pedidos se serializa sobre la cuenta mediante transacciones. Solo se permite cobrar cuando todos los pedidos están entregados; el pago completo es atómico e idempotente para el mismo medio/referencia. Por ahora no hay pagos parciales, división de cuenta, cancelación de pedidos por QR ni devolución de una cuenta pagada; la anulación de ventas de mostrador permanece disponible. Los reportes reconocen ingresos al pagar, usando `paidAt`, con compatibilidad con ventas antiguas.

La cuenta se consulta con un identificador aleatorio de visita, no con un número de mesa secuencial. Quien tenga el QR puede unirse a la cuenta abierta de ese lugar; es una cuenta compartida por mesa, no una cuenta individual por cliente. El enlace de consulta de la visita no debe compartirse fuera del grupo. Las actualizaciones usan Socket.IO sobre WebSocket y change streams de MongoDB, también entre varias instancias de la API. El proxy debe permitir el upgrade WebSocket en `/api/socket.io/`. El cliente abre el socket solo si su cuenta abierta tiene pedidos; lo cierra al pagar o salir. Cocina se suscribe solo si quedan pedidos sin entregar; mesero y administrador, mientras quedan pedidos pendientes de pago. Sin órdenes no hay socket: una consulta de actividad cada 5 segundos detecta la primera y entonces se suscribe. Con el socket conectado no se hacen consultas periódicas. Si se corta, se reconecta y recupera un estado actualizado. Las notificaciones aparecen en el panel mientras está abierto, sin notificaciones push del sistema.

## Arquitectura y compatibilidad

La arquitectura definida por el proyecto es obligatoria y está documentada en `AGENTS.md`: `index.js` inicia el servidor, `app.js` ensambla middleware y `api/api.js` compone las rutas de `routes/<entidad>/routes.js`. La lógica vive en `controllers/<entidad>/controller.js` y todos los modelos se construyen una sola vez con `OwlModel` en `models/models.js`, extendiendo los esquemas originales de `models/<entidad>/model.js`.

El backend no importa Mongoose ni lo declara como dependencia directa. Todos los modelos, consultas, escrituras condicionales, transacciones, agregaciones, índices y streams usan la API pública de `owl-expressjs-utils`. Los tipos de los campos también se importan desde OWL. No existen handles de modelos nativos ni adaptadores locales.

Se consume una revisión inmutable del repositorio original de OWL que incorpora las operaciones necesarias para las órdenes, inventario y recuperación de contraseñas. El lockfile fija la revisión y la integridad del paquete compilado; `.npmrc` permite esa dependencia remota directa. Mongoose permanece encapsulado dentro de OWL.

Las bebidas requieren `drinkType` (`alcoholic` o `non_alcoholic`) al crearse o editarse. La API rechaza valores ausentes, vacíos o inválidos, y el formulario no permite guardar sin seleccionarlo. Las bebidas existentes sin clasificación deben completarse al editarlas; no se adivina el contenido de alcohol a partir de su nombre.

### Migración desde la implementación anterior

Las colecciones paralelas `restaurant*` se copian a las entidades canónicas (`User`, `Product`, `Promo`, `Cart`, etc.) en **una sola transacción**. Se conservan IDs, hashes, timestamps, referencias, inventario y pagos. Las fuentes no se borran. Una marca persistente evita volver a copiar datos antiguos; cualquier conflicto revierte la migración completa sin sobrescribir registros.

Antes de actualizar una instalación anterior, desplegá la protección de mantenimiento y activá `MAINTENANCE_MODE=true` en esa versión. Esto bloquea solicitudes de clientes mientras continúan los checks operativos. Después desplegá esta versión: al iniciar ejecuta la migración y verifica las cuentas. Comprobá la revisión y `/api/ready`, y desactivá mantenimiento. Si hay datos anteriores y no se activó mantenimiento, el arranque rechaza migrarlos automáticamente. Una instalación nueva no necesita esta migración.

## API

| Método     | Ruta                                 | Descripción                                                       |
| ---------- | ------------------------------------ | ----------------------------------------------------------------- |
| GET        | `/api/health`                        | Salud del servidor                                                |
| GET        | `/api/public`                        | Configuración, carta y promociones vigentes; sin stock privado    |
| GET        | `/api/auth/status`                   | Estado de sesión                                                  |
| POST       | `/api/auth/login`                    | `{ username, password }` (correo compatible para clientes anteriores)                                             |
| POST       | `/api/auth/logout`                   | Cerrar sesión                                                     |
| POST       | `/api/public/tables/:token/join`     | Entrar a la cuenta abierta de una mesa sin autenticación |
| GET        | `/api/public/bills/:token`           | Cuenta de visita: pedidos, total, saldo y pago |
| POST       | `/api/public/bills/:token/orders`    | `{ requestId, notes, items }`; precios calculados y stock reservado |
| GET        | `/api/public/bills/:token/activity`  | Detecta pedidos sin abrir un socket |
| GET        | `/api/admin/service`                | Cuentas abiertas y pedidos; todos los roles internos |
| GET        | `/api/admin/order-activity`         | Detecta pedidos activos para el rol; sin socket |
| PATCH      | `/api/admin/orders/:id`              | `{ status }`: `preparing`, `ready` o `delivered`, según rol |
| POST       | `/api/admin/bills/:id/pay`           | `{ method: "cash" / "sinpe" / "card", reference? }`; administrador o mesero |
| GET / POST | `/api/admin/tables`                  | Listar QR y crear mesa con `{ name }`; administrador |
| PATCH      | `/api/admin/tables/:id`              | Pausar/activar con `{ active }`; administrador |
| GET / POST | `/api/admin/accounts`                | Listar/crear accesos `{ name, username, password, role }`; administrador |
| GET        | `/api/admin/state`                   | Productos, configuración y últimos 100 movimientos/ventas         |
| PUT        | `/api/admin/settings`                | Actualizar configuración y medidas                                |
| POST / PUT | `/api/admin/products[/:id]`          | Crear o editar producto; no modifica stock                        |
| POST       | `/api/admin/products/:id/stock`      | `{ delta, reason }`, en ml o unidades                             |
| POST / PUT | `/api/admin/promotions[/:id]`        | Crear o editar promoción                                          |
| POST       | `/api/admin/sales`                   | `{ requestId, label, paymentMethod, items: [{ productId, serving, quantity }] }` |
| POST       | `/api/admin/sales/:id/void`          | `{ reason }`                                                      |
| GET        | `/api/admin/reports?from=ISO&to=ISO` | Desde inclusivo, hasta exclusivo; sin fechas: todo el historial   |

Todos los endpoints `/admin` requieren la cookie de sesión. Excepto las rutas operativas indicadas arriba y `/admin/state` (con contenido reducido para cocina/mesero), requieren rol `admin`. `role` es `admin`, `kitchen` o `waiter`. `paymentMethod` es `cash`, `sinpe` o `card`; clientes antiguos de mostrador que lo omitan registran efectivo. `serving` es `large`, `small` o `shot` para licores; para comidas, snacks y bebidas por unidad no se necesita. El historial completo permanece en MongoDB y alimenta reportes, aunque el panel muestra las últimas 100 ventas y movimientos.

## Validación

```sh
npm test
npm audit
```

Pruebas de integración sobre MongoDB replica set real temporal: acceso, OWL y contraseñas, carta pública, medidas, venta mixta, reversión por falta de saldo, concurrencia, idempotencia, mermas, anulaciones y reportes. No requieren acceso a tu base configurada.

## Agenda de eventos

Un administrador crea y edita eventos en `/api/admin/events` (POST) y `/api/admin/events/:id` (PUT). Campos: `title`, `kind` (`music`, `karaoke`, `sports`, `other`), `description`, `image`, `starts`, `ends`, `location`, `admission`, `active`, `isSample`. Se requieren inicio y fin juntos o ambos pendientes. Se rechazan rangos invertidos. Los eventos activos no vencidos se devuelven en `/api/public`; los pausados o vencidos se ocultan. El panel permite publicar, pausar y editar, conservando los datos en MongoDB.

## Sockets de órdenes

El servidor HTTP comparte la sesión de Express con Socket.IO. El canal es relativo al mismo origen: `/api/socket.io/`, exclusivamente con transporte WebSocket. No se fija un host de sockets en el frontend; el navegador usa automáticamente el origen actual y WSS bajo HTTPS. El origen permitido se toma de `FRONTEND_URL` en `.env`; MongoDB y el secreto de sesión siguen viniendo del mismo archivo.

El handshake acepta `{ kind: "bill", token }` para clientes con pedidos en una cuenta abierta, o `{ kind: "staff" }` con la cookie de administrador/mesero/cocina y órdenes activas para ese rol. El servidor rechaza cuentas vacías o pagadas, sesiones ausentes y orígenes ajenos. Los clientes no pueden elegir salas arbitrarias. `orders:changed` invalida el estado de la cuenta o del panel, que se recupera mediante los endpoints autorizados; las mutaciones conservan sus transacciones e idempotencia HTTP. Al reconectar se solicita un estado actualizado, aunque hayan ocurrido cambios durante la desconexión.

Existe un solo change stream por proceso de API mientras haya sockets; se cierra al desconectarse el último. Cada proceso observa los commits de MongoDB y actualiza sus clientes locales, sin requerir un adapter de Socket.IO entre procesos. En producción las instancias deben compartir MongoDB, el almacén de sesiones y el secreto de sesión. El proxy debe transmitir `Upgrade` y `Connection` y conservar la conexión. El proxy de Angular incluye `ws: true`; reiniciarlo al cambiar esa configuración.

Las antiguas rutas SSE de órdenes se retiraron. `/api/admin/events` sigue siendo la ruta POST de la agenda de eventos, independiente de las notificaciones de órdenes.

## Paquete para Render Free y Atlas

El despliegue preferido ahora es **separado**: `npm run bundle:production` genera `backend/` para Render y `frontend/` para Cloudflare Pages, con configuración en el entorno y un gateway de HTTP/WebSockets. No activar `FRONTEND_DIST` en ese backend. Ver `deploy/separate/README.md` para los pasos y las variables. La variante anterior de un solo servicio se puede generar explícitamente con `npm run bundle:production -- --combined`.

`npm run bundle:production -- --combined` compila el frontend hermano y crea una carpeta nueva y un `.tar.gz` en `release/`, sin `.env`, base local ni `node_modules`. Se puede ajustar `FRONTEND_SOURCE_DIR` si cambia la ubicación del frontend. El paquete incluye la API, la carta compilada, manifiesto de archivos, `render.yaml`, ejemplo de entorno y guía de despliegue. La guía fuente está en `deploy/README.md`.

En la variante combinada, el Blueprint de Render configura el plan Free y usa el origen que el proveedor inyecta en `RENDER_EXTERNAL_URL`; para dominio propio se indica `FRONTEND_URL`. Las conexiones de MongoDB, secretos y credenciales siguen en variables de entorno. `ENV_FILE` permite seleccionar un archivo privado explícito, sin reemplazar las variables que ya inyectó el proveedor. Producción valida la configuración, escucha en `HOST`/`PORT`, admite HTTPS detrás del proxy y sirve Angular con `FRONTEND_DIST`. `/api/ready` comprueba MongoDB y devuelve 503 durante el cierre.

No se permite el modo demo ni el autostart de MongoDB local en producción. Las contraseñas nuevas requieren al menos 12 caracteres y se rechazan las credenciales de prueba conocidas. Los eventos de muestra se ocultan públicamente en ese modo. No se modifica el entorno local ni se copian sus ventas al paquete.

Para rotar una contraseña existente se usa `npm run account:password` con `DB_HOST`, `RESET_USERNAME` y `RESET_PASSWORD` en el entorno. El comando conserva el hashing de OWL e invalida las sesiones HTTP y sockets anteriores. No ejecutar sobre la base local salvo que se quiera cambiar deliberadamente su acceso.

Render Free se suspende después de 15 minutos sin tráfico y no ofrece continuidad de producción; sirve para una prueba pública gratuita. Consultar la guía del paquete antes de publicar el QR del negocio. La versión de muestra de Texas Tango debe reemplazarse por una copia con licencia web para la publicación comercial.

## Imágenes en Cloudinary

La API recibe `POST /api/admin/images?purpose=product|promotion|event|branding` con un solo archivo multipart en `image`. Solo un administrador autenticado puede subir archivos. El servidor admite JPG/PNG/WebP de hasta 5 MB y valida la firma del archivo antes de llamar a Cloudinary. El frontend usa la sesión actual y nunca carga archivos directamente a Cloudinary.

Configurar `CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME` exclusivamente en el `.env` de la API o en Render Environment. También se admiten las tres variables `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. `CLOUDINARY_FOLDER` define la carpeta raíz (obligatoria para subir). No copiar estas credenciales al frontend ni a Cloudflare Pages. Si no están configuradas, la carta sigue funcionando y la subida devuelve 503 con una explicación.

Los archivos se procesan en memoria, sin depender del disco efímero de Render. La API firma la subida mediante `upload_stream` y devuelve únicamente la URL HTTPS, identificador público y dimensiones. En el panel se puede cargar una imagen para productos, promociones, eventos o portada; la vista previa cambia al completar la subida y se publica al guardar el formulario. Una carga fallida conserva la imagen anterior. No se elimina automáticamente una imagen reemplazada porque puede estar referenciada por otro contenido.

## Configuración inicial protegida

En producción la API inicia sin crear un administrador desde `ADMIN_*`. Abrir el frontend con una base nueva muestra `/setup`, donde se registra el primer administrador con usuario, nombre opcional y contraseña de al menos 12 caracteres. Se guarda con el hash de OWL y se inicia sesión. Una instalación con administrador existente conserva su acceso y bloquea esa vista.

`GET /api/setup/status` devuelve `{required, businessRequired}`. Los guards Angular `configuredGuard` y `firstAdminGuard` consultan ese estado para redirigir la carta y el panel al registro cuando hace falta, y bloquear `/setup` una vez configurado. `POST /api/setup/admin` exige la misma condición en el backend; una transacción con un lock compartido serializa registros simultáneos. No se debe borrar la base local para probar este flujo: usar una base nueva independiente. No se cargan usuarios de prueba ni marcas desde el entorno. Tras el registro se completa `/business/setup`; sus datos se guardan en Business.

## Dependencias y OWL

OWL administra el hash y comparación de contraseñas, conexión MongoDB, sesiones, CORS y limitadores. No hay imports directos de bcrypt ni una segunda implementación de autenticación. `bcryptjs` es una dependencia interna de OWL y permanece transitivamente; no se instala directamente. `express-session` se declara solo para las pruebas que usan un almacén temporal.

Los módulos de pagos, inventario y pedidos conservan validaciones y transacciones específicas. Cloudinary, Multer, QRCode, Socket.IO y Helmet cubren funciones que OWL no reemplaza. Los antiguos entry points `index.js` y `app.js` remiten al servidor y fábrica actuales. Se eliminaron las dependencias de plantillas, logging y correo sin uso en la aplicación.

## Despliegues con GitHub Actions

El workflow `.github/workflows/deploy.yml` valida cada pull request y cada push a `main`. Solo los pushes a `main` o una ejecucion manual desde `main` pueden publicar. Si alguna prueba falla, no se actualiza produccion.

Actions publica un artefacto validado en la rama `production`, sin secretos ni dependencias instaladas. La rama conserva el historial de despliegues y contiene `deployment.json` con la revision fuente. El job de publicacion tiene `contents: write`; las pruebas solo tienen lectura. No se necesitan tokens personales ni claves de los proveedores en GitHub.

Configurar la variable de repositorio `DEPLOYMENT_URL` con el origen HTTPS publico. El workflow espera a que el proveedor sirva la misma revision y a que `/api/ready` responda correctamente. Un timeout marca el workflow como fallido; no se presenta una publicacion pendiente como exitosa.

Render debe observar `production`, ejecutar `npm ci --omit=dev --ignore-scripts`, iniciar con `npm start` y mantener `/api/ready` como healthcheck. Las conexiones y credenciales siguen en Render Environment. El endpoint publico `/api/deployment` informa solo la revision de codigo publicada.

## Optimizacion TinyPNG y almacenamiento Cloudinary

El flujo de imagenes es navegador -> API -> TinyPNG -> Cloudinary. El backend valida formato y firma, envia el buffer a TinyPNG y descarga el resultado por HTTPS autenticado. Si el archivo ya pesa menos, conserva la version mas liviana. Solo despues realiza la subida firmada a Cloudinary. JPG, PNG y WebP mantienen su formato y transparencia; no se convierten ni se redimensionan. La respuesta incluye los bytes originales, finales y ahorrados.

Definir `TINIFY_API_URL` y `TINIFY_API_KEY`, ademas de `CLOUDINARY_URL` (o sus tres campos separados) y `CLOUDINARY_FOLDER`, exclusivamente en el entorno del backend. No copiar secretos a GitHub, Pages ni Angular. El frontend solo envia multipart a la API. Sin configuracion, ante un cupo agotado o error de TinyPNG no se sube una version sin optimizar y se conserva la imagen anterior. No hay reintentos automaticos que consuman compresiones extra.

Esta optimizacion se aplica a las nuevas subidas desde el panel; las URLs externas ingresadas manualmente no pasan por esta subida. Las imagenes ya guardadas no se modifican retroactivamente. Referencia: https://tinypng.com/developers/reference/http y https://cloudinary.com/documentation/node_image_and_video_upload.


### Perfil y recuperación de acceso

Todos los roles pueden editar su nombre y username en **Mi perfil**. El servidor deriva la cuenta de la sesión e ignora identificadores, roles y contraseñas enviados al editar el perfil. Cambiar la contraseña exige la contraseña actual y una nueva clave de al menos 12 caracteres, y revoca las demás sesiones.

En el login, **Olvidé mi contraseña** crea una solicitud temporal de 30 minutos asociada a ese navegador mediante la sesión HttpOnly. Un administrador consulta **Equipo y roles → Recuperación de contraseñas**, verifica la identidad de la persona y aprueba o rechaza. La persona consulta la aprobación en el mismo navegador y elige su nueva clave. La aprobación es de un solo uso y se consume dentro de la misma transacción que cambia la contraseña. No se envían claves temporales ni se habilitan enlaces públicos de cambio de contraseña. Las solicitudes de usuarios inexistentes reciben la misma respuesta pública. Si el único administrador perdió el acceso, el operador conserva el comando `account:password`; la recuperación pública no evita la aprobación.

Las bebidas admiten `drinkType: alcoholic | non_alcoholic`. Los productos existentes sin clasificación se conservan sin adivinar su contenido de alcohol y pueden clasificarse al editarlos.

### Carta pública: búsqueda y paginación

`GET /api/public/menu` recibe `q`, `category` (`all|food|drink|snack`), `drinkType` (`all|alcoholic|non_alcoholic`), `page` y `pageSize` (1–24; por defecto 9). La búsqueda literal consulta nombre y descripción, sin distinguir mayúsculas ni acentos. Los filtros y la paginación se ejecutan en el backend mediante OWL; el orden estable usa nombre e ID. La respuesta contiene `items`, `total`, `page`, `pageSize` y `pageCount`. Una página fuera de rango se ajusta a la última disponible.

`GET /api/public/menu/:id` carga los detalles actuales de un producto activo. `GET /api/public` conserva la configuración y agenda, y entrega la primera página en `menu`; el campo de compatibilidad `products` contiene únicamente esos mismos elementos, no todo el catálogo.

El administrador configura `Business.showMenuPrices` desde Personalización. Por defecto los precios se muestran. La preferencia controla su presentación en la carta y el modal; los pedidos, cuentas y pagos conservan su desglose y sus importes. No cambia los precios almacenados.

### Imágenes y cuentas públicas

La configuración explícita `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` tiene prioridad sobre `CLOUDINARY_URL`. Definí las tres variables juntas; una configuración parcial se rechaza. Solo se usa `CLOUDINARY_URL` cuando no se definió ninguna de las tres. Las credenciales deben pertenecer al mismo entorno de Cloudinary.

La vista del cliente está en `/cuenta`; los QR anteriores `/?mesa=...` siguen redirigiendo a esa ruta. `GET /api/public/accounts?q=...` busca cuentas abiertas por nombre (2–80 caracteres, coincidencias literales con acentos, máximo 8 resultados sin tokens ni saldos). Al seleccionar una, `GET /api/public/accounts/:id` devuelve su cuenta; una cuenta cerrada no puede abrirse mediante esta búsqueda. Este acceso por nombre es público, igual que el acceso por QR.

Las líneas de pedidos tienen `fulfillmentStatus`: bebidas y snacks usan `pending → delivered`; comidas usan `preparing → ready → delivered`. `PATCH /api/admin/orders/:id` admite `itemIndex` para avanzar una línea, con permisos y transiciones validados en el servidor. No se cobran cuentas hasta que todas las líneas se hayan servido. Los registros anteriores se interpretan al leerlos sin sobrescribir su historial.
