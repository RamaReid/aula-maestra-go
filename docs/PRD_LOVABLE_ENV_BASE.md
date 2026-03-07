# PRD Base de Entorno y Datos (Lovable Cloud)

## 1. Objetivo

Definir las condiciones minimas de entorno, datos y operacion que Lovable Cloud debe garantizar para que la app funcione de forma estable.

Este documento cubre lo que depende de plataforma/infraestructura y no del codigo de frontend.

## 2. Alcance

Incluye:

- base de datos y migraciones
- secretos y edge functions
- auth, RLS y permisos
- storage, backups y restore
- observabilidad, soporte e incidentes

No incluye:

- diseño UX
- prompts pedagogicos
- priorizacion curricular de producto

## 3. Principio operativo

Si algo falla por entorno, el equipo de app no puede corregirlo desde el repo.

Por eso Lovable debe proveer control operativo sobre:

1. schema vigente
2. funciones desplegadas
3. secretos validos
4. permisos y red
5. logs y diagnostico

## 4. Requerimientos funcionales de plataforma

### E1. Gobernanza de migraciones

- aplicar migraciones en orden del repo
- bloquear deploy de funciones si schema objetivo no esta aplicado
- exponer estado de migraciones (aplicada, pendiente, fallida)
- refresh de schema cache luego de cambios

### E2. Versionado de funciones

- desplegar funciones con referencia de commit (sha)
- evitar mezcla de versiones (frontend nuevo + function vieja)
- permitir rollback a version previa estable

### E3. Secretos y variables

Lovable debe mantener en runtime:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`

Y debe soportar:

- rotacion sin downtime relevante
- chequeo de salud de secretos luego de rotacion

### E4. Conectividad saliente

Permitir acceso desde functions a:

- `abc.gob.ar`
- `ai.gateway.lovable.dev`

Debe existir verificacion de reachability por entorno.

### E5. Storage y archivos

- buckets creados y politicas activas
- upload, upsert y lectura publica controlada
- manejo de fallback temporal cuando no hay persistencia

### E6. Auth y RLS

- auth operativo para usuarios reales
- politicas RLS activas y consistentes con ownership
- service role solo en funciones server-side

### E7. Integridad de datos

- constraints y foreign keys en estado valido
- no permitir columnas requeridas ausentes en runtime
- chequeos de integridad post-migracion

## 5. Requerimientos no funcionales

### N1. Observabilidad minima

Por cada request en funciones:

- timestamp
- function name
- request id
- user id (si aplica)
- resultado (ok/error)
- mensaje de error completo

### N2. Soporte operativo

Lovable debe poder responder:

- que version de function esta activa
- que migraciones faltan
- que secreto/permiso fallo
- como reproducir el error en entorno

### N3. Backups y restauracion

- backup diario de DB
- retencion minima acordada
- prueba de restore periodica
- runbook de restauracion ante incidente

### N4. Ambientes

Definir y mantener:

- entorno de desarrollo
- entorno de preproduccion (staging)
- entorno de produccion

No promover a produccion sin smoke test minimo.

## 6. Datos criticos del producto

Tablas/familias que deben estar estables:

- `courses`, `plans`, `plan_lessons`
- `curriculum_documents`, `curriculum_nodes`
- `plan_content_mappings`, `plan_lesson_content_links`
- `lesson_briefs`, `teaching_materials`, `reading_materials`
- `user_entitlements`, `usage_counters`

Si alguna queda fuera de sync, el flujo principal se rompe.

## 7. Criterios de aceptacion de entorno (DoD tecnico)

### A. Estado de schema

- sin migraciones pendientes
- sin errores tipo "column not found" en tablas core

### B. Estado de functions

- todas las functions core deployadas desde mismo commit
- smoke test de invocacion exitoso

### C. Estado de secretos/red

- secretos presentes y validos
- conectividad saliente verificada

### D. Estado de storage

- lectura y escritura de PDF operativas

### E. Estado de observabilidad

- logs accesibles y trazables por request id

## 8. Matriz de responsabilidades

### Equipo App (repo)

- codigo frontend/backend
- migraciones versionadas
- definicion funcional y validaciones de producto

### Lovable Cloud (plataforma)

- aplicar migraciones
- desplegar functions correctas
- gestionar secretos
- asegurar red, storage, auth y logs
- operar incidentes de entorno

## 9. Entregables pedidos a Lovable

1. evidencia de migraciones aplicadas por entorno
2. lista de functions activas + sha de despliegue
3. verificacion de secretos cargados
4. resultado de smoke tests base
5. canal y SLA de soporte para incidentes de entorno

## 10. Relacion con PRD de flujo estrella

Este PRD es prerequisito tecnico.

Luego aplicar:

- `docs/PRD_LOVABLE_CORE_FLOW.md`

Orden recomendado:

1. estabilizar entorno y datos (este documento)
2. validar flujo estrella de producto (core flow)
