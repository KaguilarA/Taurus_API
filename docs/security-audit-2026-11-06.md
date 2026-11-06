# Auditoría de seguridad — Felos — 6 de noviembre de 2026

## Dictamen y alcance

Revisión de código del backend Taurus_API y frontend Taurus_FE, dependencias instaladas,
configuración de publicación, pruebas automatizadas y comprobaciones no destructivas
de los servicios públicos. Referencia: [OWASP ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/).
No constituye una certificación ASVS L3 ni una prueba de penetración independiente.
No se modificaron contraseñas existentes, inventario, pedidos ni pagos para probar seguridad.
No se almacenó ni volvió a importar la factura del usuario.

## Hallazgos corregidos

| Prioridad | Hallazgo | Corrección y evidencia |
| --- | --- | --- |
| Alta | Las entradas de contraseña permitían cadenas con formato bcrypt que OWL considera hashes ya preparados; esto podía eludir la política de nuevas claves. | Rechazo en las entradas HTTP antes de OWL; registro, cambios, recuperación, configuración y rotación usan la validación correspondiente. Prueba de registro sin creación de cuenta y pruebas de representaciones bcrypt. OWL conserva la responsabilidad del hashing. |
| Media | No había un límite absoluto de sesión y la cookie se renovaba durante 24 h. | Inactividad de 30 min y máximo absoluto de 8 h comprobados en servidor; cookie OWL de 30 min. Los sockets se comprueban periódicamente y no renuevan actividad. Las sesiones existentes adquieren los límites en su primera solicitud para conservar continuidad. |
| Media | Contraseñas nuevas insuficientemente largas y posible truncamiento silencioso a 72 bytes por bcrypt. | Mínimo de 15 caracteres para claves nuevas de producción y cambios/restablecimientos; máximo de 72 bytes UTF-8, verificado antes del hashing. No se impone retroactivamente al login de cuentas existentes; prueba de compatibilidad con clave anterior de 13 caracteres. |
| Media | El middleware reutilizable de auditoría incluía cuerpos, URLs, parámetros y consultas potencialmente sensibles; interceptar tres métodos podía duplicar registros. | Solo método, plantilla de ruta, permiso y resultado por defecto; una suscripción `finish`. Prueba de exclusión de contraseñas, tokens y factura y de registro único. Este middleware heredado no está conectado globalmente a las rutas actuales. |
| Media | Errores inesperados podían imprimir objetos internos completos. | Respuesta genérica y log de incidente aleatorio sin error, cuerpo, URI de base de datos ni credenciales; identificador `X-Incident-ID` para correlación. |
| Media | El proceso de PDF/OCR heredaba todas las credenciales del backend. | Entorno mínimo del hijo, sin DB_HOST, SESSION_SECRET ni credenciales de servicios. Continúan los límites de tamaño, páginas, tiempo y concurrencia. Es aislamiento de proceso, no un sandbox del sistema operativo. |
| Media | Una pestaña antigua podía solicitar módulos eliminados tras publicar y recibir HTML del fallback SPA. | Retención limitada a dos generaciones anteriores de archivos JS/CSS con hash; rutas Worker para devolver 404 real si el módulo no existe; comprobación del grafo de módulos, incluidas importaciones diferidas, antes de aceptar una publicación. Pruebas de cuatro generaciones y de MIME incorrecto. |
| Preventiva | Dependencias de acciones por etiqueta mutable y falta de control recurrente de vulnerabilidades. | Checkout/setup-node fijados a commits, mínimo permiso de escritura solo en publicación, instalación sin scripts, auditoría npm que bloquea vulnerabilidades altas/críticas y Dependabot semanal para npm y Actions. |
| Preventiva | Defensa adicional frente a CSRF y permisos innecesarios del navegador. | Rechazo de escrituras con Fetch Metadata `cross-site` aun sin Origin, además del control de Origin existente; Permissions-Policy y HSTS en frontend. |

La actividad de sesión se persiste con granularidad de un minuto para no escribir en
MongoDB en cada lectura. La transición de sesiones anteriores toma como inicio su
primera solicitud con esta versión. El polling HTTP autenticado cuenta como actividad;
el límite absoluto sigue forzando reautenticación a las 8 h. El polling WebSocket no
renueva ninguno de los límites. La revocación por logout/cambio de contraseña y versión
de sesión se conserva.

## Controles existentes comprobados

| Área ASVS | Evidencia revisada | Alcance / resultado |
| --- | --- | --- |
| V6 autenticación | Login, regeneración de sesión, límites OWL de intentos, recuperación aprobada por administrador y de consumo único | Pruebas de autenticación, recuperación, concurrencia y revocación pasan. Sin MFA; no se declara cumplimiento integral. |
| V7 sesiones | Cookie Secure/HttpOnly/SameSite=Lax, almacenamiento OWL, cambio de versión de cuenta, límites HTTP y WebSocket | Cookie real detrás de proxy HTTPS probada; vencimiento comprobado antes de consultar datos privados. |
| V8 autorización | Administración y perfiles, roles waiter/kitchen/admin, stock, importación y sockets de cuenta | Pruebas de acceso anónimo, rol insuficiente, perfiles ajenos y suscripción cruzada; no se confía en permisos del frontend. |
| V1/V2/V4 entradas y API | Validación de tipos y campos permitidos, JSON 256 KB, firmas de archivo y multipart acotado, consultas mediante OWL | Sin imports directos de Mongoose ni modelos paralelos. Pruebas rechazan firmas falsas, campos inválidos y escrituras no autorizadas. |
| V5 archivos | Facturas PDF/imágenes en RAM, sin OCR externo, límite de 10 MB, 20 páginas digitales/3 escaneadas, un proceso/90 s | Pruebas de OCR y privacidad; buffer descartado al terminar. No se conserva archivo, OCR, número legible ni borrador. Solo movimientos de negocio y hashes de deduplicación. |
| V9 tokens | Tokens de cuenta/mesa, permisos de sockets y separación de suscripciones | Las pruebas impiden suscribirse a otra cuenta sin su token; el descubrimiento público por nombre sigue siendo una decisión de negocio pendiente de endurecer. |
| V12 transporte | HTTPS público, cabeceras Helmet y Pages, proxy de origen fijo, eliminación de forwarding suministrado por cliente | Cookies y WebSocket pasan por el mismo origen; no hay proxy a URL arbitraria. |
| V13 configuración | Entorno, validación al arranque, artefactos sin secretos, privilegios de CI, readiness y revisión de dependencias | `npm audit` completo: 0 vulnerabilidades conocidas en ambos proyectos al revisar. Búsqueda acotada de patrones de secretos y archivos sensibles en archivos versionados: sin candidatos; no equivale a escaneo completo del historial. |
| V14 datos | Respuestas privadas no-store, proyecciones de productos públicos y factura efímera | Pruebas verifican que costos de compra no se exponen en catálogo público y que facturas no se persisten. |
| V15 arquitectura | Transacciones e índices de inventario/pagos, importaciones idempotentes y escrituras condicionales | Pruebas de compras/ventas concurrentes, confirmación duplicada, pagos y reversión atómica. |
| V16 logs | Eliminación de datos sensibles por defecto e incidentes sin detalles privados | Falta centralizar eventos de seguridad con alertas, retención y protección frente a alteración. |

## Validación y rendimiento

- Suite backend local inicial: 108/108; después de los últimos cambios, regresión de
  producción/facturas: 21/21 y seguridad: 5/5. CI ejecuta la suite completa de nuevo al publicar.
- Frontend: 78/78; pruebas de publicación/proxy: 7/7; compilación de producción correcta.
- Bundle inicial antes y después: 351,68 kB; 94,51 kB de transferencia estimada después.
- Antes de publicar, grafo público completo: 50 módulos JavaScript válidos, incluidas rutas diferidas.
- Muestras de red antes de publicar: `/api/health` 296 ms, `/api/public` 804 ms.
  Son observaciones puntuales desde este equipo, no percentiles ni una prueba de carga.
- Pruebas de importación: ajuste existente 27,1 ms, preview con lector simulado 21,1 ms,
  confirmación transaccional de cinco renglones 134,1 ms. No se añade lectura de base
  de datos al límite de sesión; las marcas cambian como máximo una vez por minuto.

## Pendientes para un nivel de aseguramiento alto

Estos controles **no están acreditados** y no deben presentarse como aprobados:

1. **Autenticación:** MFA/passkeys para personal, especialmente administradores;
   reautenticación reciente para cambiar identificadores de acceso, aprobar recuperación
   o restablecer otras cuentas; comprobación local de contraseñas contra un catálogo
   amplio de claves comprometidas. Las claves anteriores se preservaron por compatibilidad.
   El hashing actual depende de OWL/bcrypt; una migración a Argon2id debe implementarse
   en la API pública de OWL con actualización progresiva de hashes.
2. **Privacidad de cuentas de clientes:** la función de buscar cuentas por nombre permite
   recuperar una cuenta pública. Hace falta un diseño con PIN/QR o prueba de posesión
   para elevar ese flujo a un estándar de confidencialidad estricto, conservando la
   operación del restaurante. No se alteró unilateralmente ese contrato de negocio.
3. **Infraestructura:** verificar permisos mínimos y redes de Atlas/Render/Cloudflare,
   MFA de proveedores, rotación de secretos, recuperación de backups, límites de recursos
   y aislamiento/egress del lector PDF. No se auditó el plano de control de los proveedores.
   Un proceso hijo con menos variables no protege por sí solo ante ejecución remota.
4. **Detección y abuso distribuido:** centralizar auditoría sin datos privados, alertas,
   retención protegida y límites compartidos entre instancias; los límites OWL actuales
   son por proceso/IP. Añadir revisión de amenazas y pruebas de penetración independientes.
5. **Navegador:** CSP conserva estilos inline requeridos por la implementación actual y
   permiso de imágenes HTTPS; reducir a nonces y destinos exactos requiere comprobar
   compatibilidad y todos los orígenes de medios. El permiso `wss:` aún es amplio.
6. **Cadena de suministro:** revisar manualmente actualizaciones de la dependencia OWL
   fijada por commit, activar/verificar protección de ramas, revisiones requeridas y
   escaneo de secretos e historial en GitHub. Dependabot y npm audit no detectan toda
   vulnerabilidad lógica ni garantizan integridad de un paquete.

Referencias adicionales: [sesiones ASVS](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x16-V7-Session-Management.md),
[sesiones OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[fallback SPA de Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/).
