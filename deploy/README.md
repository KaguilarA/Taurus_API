# Felos Bar · paquete para publicar

Este directorio reúne la carta Angular compilada y la API Express con Socket.IO. Todo se sirve desde el mismo origen HTTPS; no hace falta configurar hosts de API en el navegador ni pagar dos servidores.

## Opción gratuita: Render Free + MongoDB Atlas Free

Render acepta WebSockets y da una dirección HTTPS al servicio. Su plan Free se suspende después de 15 minutos sin tráfico; volver a atender puede tardar alrededor de un minuto. No es una garantía de servicio continuo para las operaciones del bar. Atlas Free mantiene los datos fuera del filesystem efímero de Render y dispone de 512 MB, con límites de uso. Fuentes: [Render Free](https://render.com/docs/free), [WebSockets](https://render.com/docs/websocket), [Atlas Free](https://www.mongodb.com/docs/atlas/manage-clusters/).

1. Creá un proyecto y un cluster **Free** en MongoDB Atlas. Creá un usuario de base de datos con acceso `readWrite` a la base propia; no uses la contraseña de tu cuenta de Atlas. Conservá la URI de conexión para Node.js. Los caracteres especiales de la contraseña deben estar codificados para URL.
2. Subí **el contenido de este directorio** a un repositorio privado de despliegue. No agregués archivos `.env` reales ni `node_modules`. El paquete no incluye la base local ni credenciales de desarrollo.
3. En Render elegí **New → Blueprint**, conectá ese repositorio y seleccioná el plan **Free**. El archivo `render.yaml` configura Node, el comando de inicio, el healthcheck y el secreto de sesión.
4. Configurá `DB_HOST` con la URI de Atlas y verificá que `DB_NAME`: nombre elegido para tu base. Abrí la URL del frontend para registrar al primer administrador en `/setup`, con usuario y contraseña única de al menos 12 caracteres. La API no crea cuentas desde el entorno en producción.
5. Permití en **Atlas Network Access** las direcciones de salida del servicio que muestra el panel de Render. Mantené las reglas de red limitadas a las direcciones necesarias. La API necesita transacciones y change streams, por lo que requiere Atlas o un replica set.
6. Render proporciona `RENDER_EXTERNAL_URL`; la aplicación lo usa como origen público sin fijar una dirección en el código. Si agregás un dominio propio, definí `FRONTEND_URL=https://tu-dominio` sin ruta. La URL pública debe coincidir exactamente con el origen del navegador.
7. Desplegá el servicio y comprobá `/api/ready`, la carta, `/admin` y los cambios de pedidos desde dos dispositivos. Un usuario sin pedidos no debe abrir un socket; la primera orden se descubre por HTTP y habilita su suscripción.
8. Ingresá al panel, configurá el catálogo real y descargá los QR desde la dirección pública definitiva. Los QR de localhost no sirven en los celulares de los clientes.

El Blueprint deja los siguientes despliegues automáticos desactivados para evitar publicar cada cambio sin revisión. Un primer deploy fallido de base de datos suele requerir revisar la URI, los permisos del usuario o las reglas de red de Atlas; no pongás secretos en el código para solucionarlo.

## Configuración

`.env.production.example` muestra las variables. En Render se ingresan en **Environment**, que equivale al entorno del proceso; no hace falta subir un archivo secreto. Fuera de Render podés copiar ese ejemplo a un archivo privado y usar `ENV_FILE` con su ruta. El cargador respeta los valores que el proveedor ya inyectó y no los reemplaza por el `.env` de desarrollo.

`HOST=0.0.0.0` permite que el proveedor llegue al servidor. `PORT` se toma del entorno. `TRUST_PROXY=1` corresponde al proxy HTTPS de Render; si otra infraestructura agrega proxies, configurá la cantidad real de saltos de confianza. Las cookies de producción son Secure, HttpOnly y SameSite=Lax. El secreto de sesión debe permanecer estable entre reinicios e instancias.

`FRONTEND_DIST=./web` activa el servicio de archivos estáticos y las rutas de Angular. Los endpoints de API y los archivos ausentes conservan su respuesta 404; los bundles con hash usan caché larga y la página HTML se revalida. El proxy del proveedor debe soportar WebSockets en `/api/socket.io/`.

La API no inicia MongoDB local ni acepta `--demo` en producción. Los eventos marcados como muestra se ocultan de la carta. No se cargan automáticamente productos, usuarios o ventas de prueba. Una base nueva empieza sin identidad ni catalogo: primero se registra el administrador y luego se completa el perfil Business. Los datos locales existentes permanecen en tu computadora; migrarlos a Atlas es un paso separado, con respaldo previo y revisión de precios y existencias.

## Contraseñas y sesiones

Producción rechaza las contraseñas de prueba conocidas, incluida `12345678`. Si migrás una base de desarrollo, cambiá esas claves antes de iniciar el servicio.

Para rotar una cuenta existente, ejecutá `npm run account:password` desde una computadora autorizada con acceso a la base, usando `DB_HOST`, `RESET_USERNAME` y `RESET_PASSWORD` en un archivo privado seleccionado con `ENV_FILE` o en variables del proceso. La nueva contraseña se guarda con el hash de OWL y se invalidan las sesiones HTTP y sockets anteriores. No se pasan contraseñas por argumentos ni se imprimen en la consola. Este comando no depende del shell de Render, que no está disponible en el plan Free.

## Fuentes y contenido

Las fuentes se sirven desde `web/fonts`. **Texas Tango incluida es la versión de muestra de uso personal**; antes de publicar el sitio comercial, reemplazá `web/fonts/texas-tango.otf` por el archivo autorizado por una licencia Website del autor. Su aviso original está junto a la fuente. [Licencia del autor](https://billyargel.com/product/texas-tango-bold/). Bricolage Grotesque y Space Grotesk incluyen sus licencias OFL.

No se copian ventas de prueba al paquete. Confirmá el catálogo, los teléfonos y las condiciones de eventos antes de anunciar la dirección. Las imágenes que se agreguen posteriormente deben estar en el código desplegado o en almacenamiento externo persistente; el disco del plan Free no conserva archivos subidos durante la ejecución.

## Otro proveedor o Docker

El paquete también se ejecuta con Node.js 24: `npm ci --omit=dev`, seguido de `npm start` con el entorno configurado. No requiere la CLI de Angular en producción.

El Dockerfile es una alternativa portable y corre como usuario sin privilegios. Desde este directorio: `docker build -t felos-bar .`, luego `docker run --env-file TU_ARCHIVO_PRIVADO -p 10000:10000 felos-bar`. El HTTPS debe terminarse en el proxy del proveedor. La imagen no contiene `.env`, datos de MongoDB ni herramientas de pruebas.

`release-manifest.json` registra hashes de los archivos originales del paquete para revisión. Si reemplazás una fuente o modificás un recurso, generá un nuevo paquete desde el código fuente para mantener ese manifiesto consistente. No actualicés secretos de sesión al azar en cada despliegue: eso cerraría los accesos existentes.

## Subida de imágenes

Configurar `CLOUDINARY_URL` en el entorno de Render (backend) desde Cloudinary API Keys; definir `CLOUDINARY_FOLDER` con una carpeta propia. No configurar credenciales Cloudinary en Pages ni en el navegador. El panel administrativo envía una imagen JPG, PNG o WebP de hasta 5 MB a la API; el backend valida y firma la subida con Cloudinary. Una vez visible la vista previa, guardar el formulario para publicar el cambio. La carpeta y las credenciales se leen del entorno, no están incluidas en este paquete.

Para Docker, definir `HEALTHCHECK_URL` en el entorno según el puerto del servicio (ver `.env.production.example`).
