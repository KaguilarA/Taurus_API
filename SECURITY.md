# Seguridad

El informe de revisión y sus límites están en
[docs/security-audit-2026-11-06.md](docs/security-audit-2026-11-06.md).

No publiques credenciales, sesiones, tokens de clientes, bases de datos ni facturas
en issues, logs o artefactos. Comunicá vulnerabilidades al propietario del proyecto
mediante un canal privado. Las verificaciones de producción deben ser no destructivas;
las pruebas de inventario y pagos se ejecutan en bases de prueba aisladas.

CI instala desde el lockfile sin scripts y bloquea vulnerabilidades altas/críticas
conocidas. Las actualizaciones de Dependabot requieren revisión y las mismas pruebas
que cualquier cambio. OWL se revisa por separado porque está fijado a un commit.
