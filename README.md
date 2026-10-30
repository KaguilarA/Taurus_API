# Felos Bar: frontend y backend separados

Este paquete contiene dos despliegues independientes:

- `backend/`: API Express y servidor Socket.IO para **Render Free**. No contiene Angular ni sus fuentes, imágenes o HTML.
- `frontend/`: Angular compilado para **Cloudflare Pages Free**. Contiene un gateway pequeño que reenvía `/api` y `/api/socket.io` al backend; toda la lógica de negocio y el acceso a MongoDB se ejecutan en Render.

El navegador conserva las cookies HttpOnly bajo el dominio del frontend. Así las sesiones del personal y sus sockets funcionan sin depender de cookies de terceros. El gateway nunca se conecta a MongoDB. Los pedidos siguen suscribiéndose solo mientras hay órdenes activas.

## 1. MongoDB Atlas Free

Usar un cluster Free y una base propia. Crear un usuario de base de datos con permisos `readWrite` sobre esa base. No copiar la base local automáticamente. Agregar a Network Access únicamente las IP de salida que Render muestra para el servicio. El cluster debe soportar transacciones y change streams.

Si se administra mediante la integración de Atlas, un propietario de la organización debe habilitar el acceso de clientes de IA/MCP. La integración instalada no evita esa política de la organización.

## 2. Reservar el frontend en Cloudflare Pages

Crear un proyecto Pages **Direct Upload** en una cuenta Free y conservar su dirección asignada `https://NOMBRE.pages.dev`. Se puede usar el nombre disponible que el proveedor asigne; no inventar una dirección antes de crearlo. Si se elige integración Git en su lugar, el frontend fuente se compila con `npm ci` y `npm run build`, y la salida es `dist/taurus-ng-fe/browser`.

No subir con el arrastre de archivos del dashboard: el paquete incluye `_worker.js`, que debe desplegarse con Wrangler o integración Git para que el gateway quede activo.

## 3. Backend en Render

Subir el contenido de `backend/` a un repositorio privado de despliegue. En Render, crear un Blueprint con ese repositorio. `render.yaml` selecciona Free, Node 24, `npm ci --omit=dev --ignore-scripts`, `npm start` y `/api/ready` como healthcheck.

Ingresar en Environment:

- `DB_HOST`: URI privada de Atlas; contraseña codificada para URL.
- `DB_NAME`: nombre elegido para tu base.
- `FRONTEND_URL`: origen exacto del proyecto Pages, sin ruta.
- `SESSION_SECRET`: el Blueprint lo genera. Conservarlo estable entre despliegues.

No configurar `FRONTEND_DIST`. La API no servirá la carta. Conservar la dirección HTTPS que Render asigne y comprobar `/api/ready`. La raíz `/` puede devolver 404: es un backend, no una página.

## 4. Conectar y publicar el frontend

En las variables de **producción** de Pages Functions configurar:

- `BACKEND_ORIGIN`: el origen HTTPS de Render, sin `/api` ni otra ruta.
- `PUBLIC_FRONTEND_URL`: el mismo origen HTTPS que se usó en `FRONTEND_URL`.

Las variables se inyectan en el runtime, equivalentes a `.env`; no hay URLs de producción pegadas en el código o en el bundle Angular. No poner `DB_HOST`, contraseñas de MongoDB ni `SESSION_SECRET` en Pages. `.dev.vars.example` contiene los nombres para desarrollo local con Wrangler, no valores de producción.

Con Wrangler autenticado en la cuenta correcta, ejecutar desde la carpeta que contiene este README:

```
npx wrangler pages deploy ./frontend --project-name NOMBRE --branch main
```

Si se configuraron variables después del primer deploy, volver a desplegar para aplicarlas. Solo `/api` y `/api/*` ejecutan el gateway; los archivos estáticos se sirven directamente desde Pages. No habilitar Cloudflare Access para la carta pública. Los previews tienen otro origen y quedan deshabilitados para la API a menos que se configure un entorno independiente.

## 5. Verificación pública

Comprobar carta y `/admin`, entrar con el administrador de producción, escanear un QR de la URL definitiva, crear un pedido desde otro dispositivo, preparar en cocina, entregar como mesero y registrar efectivo/SIMPE/tarjeta. Sin órdenes debe verse descubrimiento HTTP, sin una conexión WebSocket; con órdenes activas debe haber eventos por WSS. No usar ventas reales para estas pruebas.

El frontend y backend se pueden actualizar por separado. Si cambia la URL de Render, cambiar `BACKEND_ORIGIN` en Pages y volver a desplegar. Si cambia el dominio del frontend, actualizar `PUBLIC_FRONTEND_URL` y `FRONTEND_URL`, y regenerar los QR.

## Límites y publicación comercial

Render Free se suspende después de 15 minutos sin tráfico y puede tardar cerca de un minuto en despertar. Pages Functions Free comparte el cupo de 100.000 solicitudes diarias de Workers; los archivos estáticos no consumen ese cupo. Son planes útiles para una prueba pública, con límites de disponibilidad y uso. Fuentes: [Render Free](https://render.com/docs/free), [Pages Functions](https://developers.cloudflare.com/pages/functions/pricing/), [WebSockets](https://developers.cloudflare.com/workers/examples/websockets/).

La Texas Tango incluida es una muestra de uso personal. Antes de publicar comercialmente, reemplazar `public/fonts/texas-tango.otf` en el frontend fuente por el archivo con licencia web del autor y generar otro paquete. Las demás fuentes incluyen sus licencias OFL. Esta generación no cambia contraseñas ni datos de la base local.

`release-manifest.json` registra hashes de todos los archivos del paquete. La carpeta `backend/` no contiene `.env`, datos de MongoDB ni frontend.

## Subida de imágenes

Configurar `CLOUDINARY_URL` en el entorno de Render (backend) desde Cloudinary API Keys; definir `CLOUDINARY_FOLDER` con una carpeta propia. No configurar credenciales Cloudinary en Pages ni en el navegador. El panel administrativo envía una imagen JPG, PNG o WebP de hasta 5 MB a la API; el backend valida y firma la subida con Cloudinary. Una vez visible la vista previa, guardar el formulario para publicar el cambio. La carpeta y las credenciales se leen del entorno, no están incluidas en este paquete.

## Primer arranque y registro del administrador

Con una base sin administrador, los guards redirigen la carta y `/admin` a `/setup`. Registrarse mediante usuario y contraseña de al menos 12 caracteres; no requiere correo ni credenciales administrativas en Render Environment. En producción no se crea ningún administrador automáticamente desde `.env`.

Tras el registro se abre `/business/setup` para guardar el perfil del negocio en Business. Luego se habilita el panel. El guard vuelve a consultar al servidor en cada navegación y redirige cualquier enlace a `/setup` hacia `/admin` cuando ya existe un administrador. La API también cierra `POST /api/setup/admin`: no depende de la seguridad del navegador. Una transacción y un documento de coordinación compartido impiden dos administradores iniciales simultáneos, incluso con dos instancias de API. Con un administrador local existente no aparecerá el formulario; probar el primer arranque con una base nueva, sin borrar los datos actuales.

Para Docker, definir `HEALTHCHECK_URL` en el entorno según el puerto del servicio (ver `.env.production.example`).
