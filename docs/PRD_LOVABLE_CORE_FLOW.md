# PRD Lovable Core Flow

## 1. Objetivo

Asegurar que el flujo estrella de la app funcione de punta a punta en Lovable Cloud:

`programa oficial -> plan anual -> clase/secuencia -> material de lectura`

Este PRD define lo que el equipo necesita de Lovable (infra, despliegue, schema y operacion) para eliminar fallas por entorno y no por producto.

## 2. Alcance

Incluye:

- entorno y backend en Lovable Cloud
- base de datos y migraciones
- edge functions y secretos
- storage y permisos
- observabilidad minima para soporte

No incluye:

- rediseno de UX
- expansion de materias
- roadmap del sistema operativo docente completo

## 3. Resultado esperado

Un docente puede:

1. seleccionar/resolver programa oficial correcto
2. crear curso con vinculo curricular estable
3. obtener borrador anual consistente
4. validar/revalidar plan sin bloqueos falsos
5. generar material didactico y lectura con trazabilidad

## 4. Dependencias de Lovable (requerimientos)

### R1. Migraciones aplicadas y schema sincronizado

Lovable debe aplicar todas las migraciones pendientes del repo en el backend conectado, con foco en:

- `supabase/migrations/20260302203000_add_curriculum_link_to_courses.sql`
- `supabase/migrations/20260302212000_align_validate_plan_with_bootstrap.sql`

Y confirmar refresh de schema cache (PostgREST) para evitar errores de columna inexistente.

### R2. Edge functions desplegadas en version vigente

Lovable debe desplegar y mantener estas funciones en la misma version del repo:

- `resolve-curriculum-document`
- `import-curriculum-pdf`
- `bootstrap-course-plan`
- `generate-materials`
- `check-course-limit`

### R3. Secretos y variables de entorno

Lovable debe garantizar que esten configuradas y vigentes:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`

Sin estas variables, importacion, bootstrap y generacion quedan parciales o fallan.

### R4. Conectividad saliente permitida

El runtime debe poder acceder a:

- `https://abc.gob.ar`
- `https://servicios.abc.gov.ar`
- `https://ai.gateway.lovable.dev`

Si se bloquea salida, la resolucion/importacion remota deja de funcionar.

### R5. Storage operativo para PDFs

Lovable debe asegurar bucket y permisos para lectura/escritura:

- bucket: `reading-materials-pdf`
- upload con `upsert`
- `getPublicUrl` operativo cuando almacenamiento persistente esta habilitado

### R6. Observabilidad minima

Lovable debe proveer logs consultables por funcion con:

- timestamp
- request id
- funcion
- error message completo

Sin esto, no se puede diagnosticar `not_found`, `ambiguous`, ni fallas de ingestion/generacion.

## 5. Criterios de aceptacion (Definition of Done)

### A1. Curso + programa

- Crear curso desde wizard con programa resuelto.
- No aparece error de columna faltante en `courses`.
- El curso muestra base curricular con vinculo persistido (no solo session fallback).

### A2. Bootstrap anual

- `bootstrap-course-plan` completa 28 clases.
- Cada clase queda con estructura usable (foco, justificacion, resultado, operacion/evidencia).

### A3. Validacion

- `validate_plan` funciona en flujo normal.
- Si falla, errores son funcionales (no errores de entorno/schema).

### A4. Generacion de materiales

- `generate-materials` produce teaching + reading con estado `VALIDATED` en caso base.
- Reading material crea PDF (persistente o temporal segun plan) sin error de storage.

### A5. Resolucion remota

- `resolve-curriculum-document` devuelve `resolved` o `ambiguous` con candidatos, no falla por entorno.
- Cuando no hay match, devuelve `not_found` con razon clara.

## 6. Casos de prueba minimos (UAT)

1. Caso principal FyHyCyT 6 EESA (PBA, tecnica): crear curso, bootstrap, validar y generar material.
2. Caso ambiguo: misma materia/anio con multiples programas; seleccion manual obligatoria.
3. Caso programa faltante: resolver `not_found` y luego importar desde `CurriculumImport`.
4. Caso regeneracion: editar plan, pasar a `EDITED`, revalidar y regenerar material.

## 7. Riesgos abiertos

- Lovable Cloud sin acceso directo a Supabase por parte del equipo puede retrasar aplicacion de migraciones.
- Diferencias entre version deployada y repo pueden reintroducir errores ya corregidos.
- Restricciones de red o secretos rotos impactan de forma silenciosa el flujo.

## 8. Entregables que debe confirmar Lovable

- evidencia de migraciones aplicadas
- hash/version de funciones desplegadas
- verificacion de secretos cargados
- prueba de salud por flujo (A1-A5)
- ventana de correccion y rollback en caso de regresion
