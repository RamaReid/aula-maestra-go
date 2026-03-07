# Contexto: IA, Prompts y Validaciones

## Cabecera de evidencia

| Campo | Valor |
|---|---|
| Fecha/hora | 2026-03-07 |
| project_ref | `jsejuuyqjtevtoguljiv` |
| Branch | main |
| commit_sha | N/A |
| Autor | Lovable AI — fase de contexto |

---

## 1. Modelos utilizados

| Flujo | Modelo | Evidencia (archivo:linea) |
|---|---|---|
| Bootstrap plan anual | `google/gemini-2.5-pro` | `bootstrap-course-plan/index.ts:433` |
| Teaching material | `google/gemini-2.5-flash` (function calling) | `generate-materials/index.ts:1366` |
| Reading material | `google/gemini-2.5-pro` | `generate-materials/index.ts:1520` |

Todos los modelos se invocan via Lovable AI gateway (`https://api.lovable.dev/v1/chat/completions`) usando `LOVABLE_API_KEY`. No se requiere API key externa de Google.

---

## 2. Variables pedagogicas en prompts

### Teaching material (lineas 1257-1305 de `generate-materials/index.ts`)

Variables inyectadas al prompt:
- `subject` — materia
- `school_type` — tipo de escuela (COMUN/TECNICA)
- `orientation` — orientacion (si aplica)
- `speciality` — especialidad (si aplica)
- `lesson_number` — numero de clase en secuencia
- `theme` — tema de la clase
- `justification` — justificacion pedagogica
- `learning_outcome` — resultado de aprendizaje esperado
- `lessonOperation` — operacion cognitiva dominante
- `minimumEvidence` — evidencia minima de logro
- `enfoque_deseado` — enfoque seleccionado por el docente
- `tipo_dinamica_sugerida` — dinamica sugerida
- `nivel_profundidad` — nivel (BAJO/MEDIO/ALTO)
- `observaciones_docente` — observaciones libres
- `curriculumContext` — nodos curriculares mapeados a la clase
- `previousPlanLesson` — datos de la clase anterior (continuidad)
- `nextPlanLesson` — datos de la clase siguiente (anticipacion)
- `bibliographyContext` — nodos bibliograficos confirmados
- `authorizedSourcesContext` — fuentes del docente (si existen)
- `disciplineCanon` — reglas canonicas de la disciplina

### Reading material (lineas 1458-1504 de `generate-materials/index.ts`)

Mismas variables que teaching, mas reglas adicionales:
- Longitud: 1000-1300 palabras
- Formato: prosa continua, sin listas (ul/ol/li), sin subtitulos (h1-h6)
- Tags `data-ref` obligatorios para cada nodo bibliografico referenciado
- Parrafo final "Fuentes de base del texto"
- Disciplinas sociales: prohibidas frases formulaicas de cierre

---

## 3. Validacion post-IA — Teaching material

Evidencia: `generate-materials/index.ts:1380-1424`

| # | Check | Detalle |
|---|---|---|
| 1 | `purpose` no vacio | String no vacio |
| 2 | `activities` no vacio | Array con al menos 1 elemento |
| 3 | `activities` incluye tipo `inicio` | Al menos 1 actividad con stage "inicio" |
| 4 | `activities` incluye tipo `desarrollo` | Al menos 1 con stage "desarrollo" |
| 5 | `activities` incluye tipo `cierre` | Al menos 1 con stage "cierre" |
| 6 | `expected_product` no vacio | String no vacio |
| 7 | `achievement_criteria` no vacio | Array con al menos 1 criterio |
| 8 | `closure` no vacio | String no vacio |
| 9 | `differentiation` incluye `apoyo` y `desafio` | Objeto con ambas keys presentes |

**Si falla:** status = `INVALIDATED` (no se reintenta).

---

## 4. Validacion post-IA — Reading material

Evidencia: `generate-materials/index.ts:321-394` (`validateReadingMaterial`)

| # | Check | Detalle | Linea |
|---|---|---|---|
| 1 | Word count 1000-1300 | `content.split(/\s+/).length` | 325-330 |
| 2 | Sin listas HTML | Rechaza `<ul>`, `<ol>`, `<li>` | 335-340 |
| 3 | Sin subtitulos | Rechaza `<h1>` a `<h6>` | 342-345 |
| 4 | Sin listas numeradas en texto | Regex contra patrones `1.`, `a)`, etc. | 347-350 |
| 5 | Sin resoluciones matematicas | Rechaza patrones `=\d+` | 352-355 |
| 6 | Tags `data-ref` presentes | Cada nodo bibliografico debe tener `data-ref="uuid"` | 360-370 |
| 7 | Parrafo "Fuentes de base del texto" | Debe existir al final | 372-378 |
| 8 | Sin frases formulaicas (sociales) | Rechaza "en conclusion", "para finalizar", etc. | 380-390 |

**Retry:** Hasta 3 intentos con feedback de errores al modelo (linea 1511-1515). Si falla 3 intentos: status = `INVALIDATED` con `validation_reasons`.

**PDF:** 2-4 paginas esperadas (verificacion informativa, no bloqueante).

---

## 5. Canon disciplinar

### FyHyCyT (Filosofia e Historia de la Ciencia y la Tecnologia)

Evidencia: `generate-materials/index.ts:1239-1244`

> "Trabaja filosofia de la ciencia, historia de la ciencia y tecnologia juntas. Prioriza casos, validacion, evidencia, metodos y decisiones responsables. No separes las tres areas en bloques aislados."

### Filosofia

Evidencia: `generate-materials/index.ts:1246-1250`

> "Trabaja problemas, conceptos, posiciones, argumentos y objeciones. No conviertas la clase en diseno experimental. Prioriza el analisis conceptual y la argumentacion filosofica."

---

## 6. Fallbacks

### Bootstrap — Golden seed FyHyCyT

Evidencia: `bootstrap-course-plan/index.ts:469-506`

Si la IA falla en bootstrap para FyHyCyT 6to EESA, se usa `GOLDEN_FYHCT_6_EESA_LESSONS`: 28 clases predefinidas con temas, justificaciones y learning outcomes verificados manualmente. Documentado en `docs/CANON_GOLDEN_FYHCT_6EESA.md`.

### Bootstrap — Generico

Evidencia: `bootstrap-course-plan/index.ts:509-565`

Para otras materias, si IA falla: genera clases genericas basadas en nombres de nodos curriculares, distribuyendo round-robin entre 2 trimestres.

### Bootstrap — Fundamentacion/Objetivos

Evidencia: `bootstrap-course-plan/index.ts:588-639`

`normalizeBootstrapPayload()` rellena campos faltantes con texto generico si la IA no los proporciona.

### Authorized source IDs

Evidencia: `generate-materials/index.ts:926` + estado de Cloud

El campo `authorized_source_ids` **NO existe en la base de datos Cloud** (migracion `20260306171000` no aplicada). `sanitizeIdList(brief.authorized_source_ids)` recibe `undefined` y retorna `[]`. **Resultado:** `generate-materials` funciona exclusivamente con bibliografia curricular (`bibliografia_confirmada`). No hay error, solo ausencia silenciosa de fuentes docente.

---

## 7. Conclusiones

- La IA se usa en 3 flujos con 2 modelos distintos (pro para bootstrap/reading, flash para teaching).
- La validacion post-IA es estricta para reading (8 checks + 3 retries) y moderada para teaching (9 checks, sin retry).
- Los fallbacks estan bien definidos para bootstrap pero no para generacion de materiales (si la IA falla 3 veces en reading, se marca INVALIDATED sin alternativa).
- El canon disciplinar esta hardcodeado para 2 materias; el resto usa prompt generico.

---

## 8. Decisiones abiertas (este documento)

| ID | Decision | Responsable | Deadline sugerido |
|---|---|---|---|
| D4 | Cuando `authorized_source_ids` no existe en cloud, el brief funciona solo con bib curricular (comportamiento actual). Se acepta esto como permanente o se bloquea brief sin la columna? | Owner producto | Post-aplicacion de migraciones |
