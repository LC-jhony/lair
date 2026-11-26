# Rollback

| Operación | Antes | Si falla | Recuperación |
| --- | --- | --- | --- |
| Descarga del manifiesto | caché anterior | no se sobrescribe | se informa la fecha del último válido |
| Instalación de binario | versión instalada en DB | staging se elimina | `site_pins` vuelve a la versión anterior + reload |
| Cambio de Caddyfile | copia `Caddyfile.<ts>` | `/load` conserva la config activa | botón "Revertir a última versión válida" |
| Confianza de CA | `caddy untrust` | estado no se marca como confiable | `caddy_untrust` |
| Migración SQLite | backup en `backups/` | tabla `_vN`, nunca `DROP` | restaurar backup |

Regla: nunca ejecutar scripts procedentes de un artefacto; extraer siempre en
staging fuera de PATH y renombrar de forma atómica.
