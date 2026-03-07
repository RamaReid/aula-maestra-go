# Context Pack — AulaMaestra (DocencIA)

## Cabecera de evidencia

| Campo | Valor |
|---|---|
| Fecha/hora | 2026-03-07 |
| project_ref | `jsejuuyqjtevtoguljiv` |
| Branch | main (Lovable Cloud, single environment) |
| commit_sha | N/A (limitacion de plataforma Lovable) |
| Autor | Lovable AI — fase de contexto |

---

## Resumen ejecutivo

Este Context Pack documenta el estado completo y verificado del proyecto AulaMaestra al 2026-03-07. Toda afirmacion critica esta respaldada por queries SQL ejecutadas contra la base de datos Cloud o por referencia exacta a archivo:linea del repositorio.

### Hallazgo principal

5 migraciones presentes en el repositorio (`20260306170000` a `20260307113000`) **NO estan aplicadas** en la base de datos Cloud. Esto causa:
- Tablas faltantes: `authorized_sources`, `authorized_source_targets`, `billing_events`, `manual_payment_requests`, `premium_query_requests`
- 12 columnas faltantes en `subscriptions`
- 1 columna faltante en `lesson_briefs` (`authorized_source_ids`)
- 2 funciones DB faltantes (`admin_upsert_billing_subscription`, `is_authorized_source_owner`)
- 20+ errores de build en edge functions (tipos generados reflejan la base real, el codigo asume migraciones aplicadas)

### Inventario verificado

| Recurso | Cantidad | Evidencia |
|---|---|---|
| Tablas en Cloud | 19 | `SELECT table_name FROM information_schema.tables WHERE table_schema='public'` |
| Edge Functions en repo | **13** | `ls supabase/functions/` excluyendo `_shared/` |
| DB Functions en Cloud | 17 | `SELECT routine_name FROM information_schema.routines WHERE routine_schema='public'` |
| Curriculum documents | 6 | `SELECT count(*) FROM curriculum_documents` |
| Curriculum nodes | 561 | `SELECT count(*) FROM curriculum_nodes` |
| Cursos creados | **0** | `SELECT count(*) FROM courses` |
| Flujos E2E ejecutados | **0** | Sin lessons, sin plan_lessons, sin materiales |
| Usuarios registrados | 2 | `SELECT count(*) FROM profiles` |

---

## Documentos del Context Pack

1. [CONTEXTO_NEGOCIO_Y_PLANES.md](./CONTEXTO_NEGOCIO_Y_PLANES.md) — Reglas por plan, definicion de fuente valida, separacion trazabilidad/bibliografia, contratos por tabla critica
2. [CONTEXTO_TECNICO_SUPABASE_EDGE.md](./CONTEXTO_TECNICO_SUPABASE_EDGE.md) — Drift matrix, inventario de 13 edge functions, contratos E/S, RLS, seguridad
3. [CONTEXTO_IA_PROMPTS_Y_VALIDACIONES.md](./CONTEXTO_IA_PROMPTS_Y_VALIDACIONES.md) — Modelos, variables pedagogicas, validacion post-IA, canon disciplinar, fallbacks
4. [CONTEXTO_OPERACION_DEPLOY_QA.md](./CONTEXTO_OPERACION_DEPLOY_QA.md) — Entorno, secretos, datos actuales, observabilidad, matriz de pruebas negativas
5. [CONTEXTO_GAPS_Y_DECISIONES_ABIERTAS.md](./CONTEXTO_GAPS_Y_DECISIONES_ABIERTAS.md) — 7 gaps con evidencia, supuestos eliminados/abiertos, opciones posteriores

---

## Criterio de aceptacion de la fase contexto

| Criterio | Estado |
|---|---|
| 0 cambios de codigo ejecutados | **CUMPLIDO** |
| 0 propuestas de implementacion | **CUMPLIDO** |
| 100% de gaps con evidencia verificable | **CUMPLIDO** — cada gap tiene query SQL o archivo:linea |
| Inventario unico de functions (13) sin ambiguedad | **CUMPLIDO** — `seed-demo-course` descartado (es componente frontend `src/pages/Demo.tsx`) |
| 0 contradicciones entre documentos | **CUMPLIDO** |
