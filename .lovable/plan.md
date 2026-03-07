

# Plan: Crear 6 archivos del Context Pack definitivo

## Contenido verificado con evidencia real

Toda la evidencia se obtuvo via queries directas a Cloud y lectura de archivos del repo. A continuacion el plan de los 6 archivos a crear (sin fixes, sin propuestas de implementacion).

---

## Archivo 1: `docs/CONTEXT_PACK_INDEX.md`

Resumen ejecutivo con:
- Cabecera (fecha, project_ref `jsejuuyqjtevtoguljiv`, branch main, commit_sha N/A, autor Lovable AI)
- Links a los 5 documentos
- Hallazgo principal: 5 migraciones en repo no aplicadas a Cloud, 0 cursos creados, 0 flujos E2E ejecutados
- Inventario: 19 tablas en Cloud, 13 edge functions en repo, 17 DB functions, 6 curriculum_documents, 561 curriculum_nodes
- Criterio de aceptacion: 0 cambios de codigo, 0 propuestas de implementacion, 100% gaps con evidencia, inventario unico de 13 functions

## Archivo 2: `docs/CONTEXTO_NEGOCIO_Y_PLANES.md`

Con cabecera estandar. Secciones:
- **Matriz de planes** (FREE/BASICO/PREMIUM) con evidencia de archivo:linea para cada regla
- **Definicion "fuente valida"** con SQL literal (`brief.bibliografia_confirmada` + `brief.authorized_source_ids`, evidencia `generate-materials/index.ts:926-933`)
- **Separacion trazabilidad vs bibliografia** (tabla por capa: bootstrap, mappings, generate, frontend)
- **Definicion "listo para generar"** (6 condiciones con archivo:linea)
- **Contrato canonico por tabla critica** (courses, lesson_briefs, subscriptions — campos obligatorios, nullable, defaults, verificados con query real)
- **Decisiones abiertas**: D4 (fallback authorized_source_ids), responsable owner producto

## Archivo 3: `docs/CONTEXTO_TECNICO_SUPABASE_EDGE.md`

Con cabecera estandar. Secciones:
- **Evidencia**: Queries SQL literales + output exacto para:
  - `SELECT table_name FROM information_schema.tables WHERE table_schema='public'` → 19 tablas
  - `SELECT column_name... WHERE table_name='subscriptions'` → 8 columnas
  - `SELECT column_name... WHERE table_name='lesson_briefs'` → 10 columnas (sin authorized_source_ids)
  - `SELECT routine_name FROM information_schema.routines WHERE routine_schema='public'` → 17 funciones
  - `SELECT count(*) FROM courses` → 0
  - `SELECT count(*), node_type FROM curriculum_nodes GROUP BY node_type` → 434 EJE, 42 UNIDAD, 9 BLOQUE, 76 CONTENIDO
  - `fetch_secrets` → solo LOVABLE_API_KEY visible (SUPABASE_* auto-provisioned)
- **Drift Matrix** (Local vs Cloud vs Repo): tabla con 10 entidades, estado por columna
- **Inventario 13 Edge Functions**: tabla con nombre, lineas, modelo IA, secretos requeridos, estado (operativa/bloqueada/parcial)
- **Contrato entrada/salida por funcion critica** (bootstrap, generate-materials, resolve-curriculum-document)
- **RLS por tabla**: output literal de `pg_policies`
- **Seguridad**: funciones que usan service_role con justificacion
- **Decisiones abiertas**: D1 (aplicar migraciones), D2 (npm: imports), D3 (secretos MP)

## Archivo 4: `docs/CONTEXTO_IA_PROMPTS_Y_VALIDACIONES.md`

Con cabecera estandar. Secciones:
- **Modelos**: gemini-2.5-pro (bootstrap, reading), gemini-2.5-flash (teaching) con archivo:linea
- **Variables pedagogicas en prompts** (lista completa desde generate-materials:1260-1305)
- **Prompt teaching completo** (referencia a lineas 1257-1305)
- **Prompt reading completo** (referencia a lineas 1458-1504)
- **Validacion post-IA teaching** (9 checks, archivo:linea 1380-1424)
- **Validacion post-IA reading** (8 checks con detalle, archivo:linea 321-394, retry hasta 3 intentos linea 1511)
- **Canon disciplinar** (FyHyCyT lineas 1240-1244, Filosofia lineas 1246-1250)
- **Fallback bootstrap** (golden seed FyHyCyT lineas 469-506, generico lineas 509-565)
- **Fallback authorized_source_ids**: campo no existe en cloud, `sanitizeIdList(undefined)` retorna `[]`, generate-materials funciona solo con bibliografia curricular
- **Decisiones abiertas**: D4 (politica fallback)

## Archivo 5: `docs/CONTEXTO_OPERACION_DEPLOY_QA.md`

Con cabecera estandar. Secciones:
- **Entorno**: unico (Lovable Cloud), 19 migraciones en repo, ultimas 5 no aplicadas
- **Secretos**: solo LOVABLE_API_KEY + SUPABASE_* auto-provisioned. Faltan 4+ secretos MP.
- **Datos actuales**: 0 cursos, 0 lessons, 0 plan_lessons, 2 usuarios, 6 curriculum_documents
- **Observabilidad**: no hay logging estructurado (sin request_id, course_id, function_name)
- **Rollback**: no documentado, sin down-migrations
- **Matriz UAT**: 0 flujos E2E ejecutados, evidencia query `count(*)=0`
- **Matriz de pruebas negativas**: 14 casos (NEG-01 a NEG-14) con archivo:linea de cada validacion
- **Decisiones abiertas**: D5 (staging separado)

## Archivo 6: `docs/CONTEXTO_GAPS_Y_DECISIONES_ABIERTAS.md`

Con cabecera estandar. Secciones:
- **7 gaps con evidencia verificable** (G1-G7, cada uno con query SQL o archivo:linea)
- **Supuestos eliminados** (4, con evidencia)
- **Supuestos abiertos** (6 decisiones D1-D6 con responsable y deadline sugerido)
- **Orden de dependencias** (diagrama texto ASCII)
- **Opciones posteriores (no ejecutadas en esta fase)**: tabla priorizada P0-P5 con DoD verificable por item
- **Criterio de salida**: 0 fixes, 0 contradicciones, 100% gaps con evidencia, inventario 13 functions

---

## Ejecucion

Crear los 6 archivos en `docs/` en una sola pasada. Total: 6 archivos nuevos, 0 archivos editados.

