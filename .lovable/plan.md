

# PRD 2 -- Motor IA Canonico: Plan de Implementacion

## Confirmacion de restricciones

- NO se modifica ninguna tabla existente de PRD 1.2 (courses, plans, plan_lessons, lessons, etc.)
- NO se alteran constraints, enums ni RLS policies existentes
- Solo se agregan tablas nuevas, columnas nuevas en `lessons`, y UI nueva
- Integracion estricta sobre `Lesson` existente

---

## Fase 1: Migracion de Base de Datos

### 1A. Nuevos enums

```text
brief_status: 'IN_PROGRESS' | 'READY_FOR_PRODUCTION' | 'PRODUCED'
material_status: 'GENERATED' | 'VALIDATED' | 'INVALIDATED'
depth_level: 'BAJO' | 'MEDIO' | 'ALTO'
```

### 1B. Nueva columna en `lessons`

- `is_generating BOOLEAN NOT NULL DEFAULT false` (control de concurrencia)

### 1C. Nuevas tablas

**lesson_briefs** (1:1 con lesson)
| Columna | Tipo |
|---|---|
| id | UUID PK |
| lesson_id | UUID UNIQUE FK -> lessons |
| enfoque_deseado | TEXT DEFAULT '' |
| tipo_dinamica_sugerida | TEXT DEFAULT '' |
| nivel_profundidad | depth_level DEFAULT 'MEDIO' |
| observaciones_docente | TEXT DEFAULT '' |
| bibliografia_confirmada | UUID[] (array de curriculum_node_id) |
| status | brief_status DEFAULT 'IN_PROGRESS' |
| created_at / updated_at | TIMESTAMPTZ |

**teaching_materials** (1:1 con lesson)
| Columna | Tipo |
|---|---|
| id | UUID PK |
| lesson_id | UUID UNIQUE FK -> lessons |
| purpose | TEXT DEFAULT '' |
| activities | JSONB DEFAULT '[]' |
| expected_product | TEXT DEFAULT '' |
| achievement_criteria | TEXT[] DEFAULT '{}' |
| differentiation | JSONB DEFAULT '[]' |
| closure | TEXT DEFAULT '' |
| status | material_status DEFAULT 'GENERATED' |
| created_at / updated_at | TIMESTAMPTZ |

**reading_materials** (1:1 con lesson)
| Columna | Tipo |
|---|---|
| id | UUID PK |
| lesson_id | UUID UNIQUE FK -> lessons |
| word_count | INT DEFAULT 0 |
| content_html | TEXT DEFAULT '' |
| pdf_url | TEXT |
| status | material_status DEFAULT 'GENERATED' |
| created_at / updated_at | TIMESTAMPTZ |

### 1D. RLS Policies (todas via is_lesson_owner)

- lesson_briefs, teaching_materials, reading_materials: ALL para owners via `is_lesson_owner(auth.uid(), lesson_id)`

### 1E. Ownership helper

- `is_lesson_brief_owner(_user_id, _brief_id)` -- para validaciones downstream si se necesita

### 1F. Storage bucket

- Bucket `reading-materials-pdf` (publico) para almacenar los PDFs generados

---

## Fase 2: Edge Function -- generate-materials

Backend function que orquesta la generacion IA.

### Entrada
```text
POST /generate-materials
Body: { lesson_id: string }
Auth: Bearer token del usuario
```

### Logica del edge function

1. **Validar precondiciones** (todo server-side):
   - Obtener lesson -> course -> plan -> plan_lesson
   - Verificar: course.status = 'ACTIVE', plan.status = 'VALIDATED', lesson.status != 'LOCKED'
   - Verificar: plan_lesson.theme, justification, learning_outcome no vacios
   - Verificar: lesson_brief.status = 'READY_FOR_PRODUCTION'
   - Verificar: lesson_brief.bibliografia_confirmada no vacio
   - Verificar: lesson.is_generating = false
   - Si falla alguna -> error 400 con mensaje especifico

2. **Setear concurrencia**: `UPDATE lessons SET is_generating = true`

3. **Obtener contexto curricular**:
   - Leer curriculum_nodes referenciados en bibliografia_confirmada
   - Armar contexto con nombres/contenidos de los nodos

4. **Generar TeachingMaterial** (Lovable AI - gemini-2.5-flash):
   - Prompt con canon obligatorio (proposito, actividades, tiempos, producto, criterios, diferenciacion, cierre)
   - Tool calling para output estructurado (JSON)
   - Insertar en teaching_materials

5. **Generar ReadingMaterial** (Lovable AI - gemini-2.5-pro para mayor calidad):
   - Prompt con canon obligatorio (1000-1300 palabras, texto corrido, sin listas, sin subtitulos)
   - Incluir tags `<span data-ref="curriculum_node_id">` invisibles
   - Validaciones tecnicas post-generacion (regex)
   - Si falla validacion: regenerar (hasta 2 intentos)

6. **Generar PDF**:
   - Render HTML a PDF via headless (o almacenar HTML y generar en frontend)
   - Subir a storage bucket
   - Validar 2-4 paginas

7. **Finalizar**: `UPDATE lessons SET is_generating = false`, actualizar brief.status = 'PRODUCED'

8. **Error handling**: try/catch que siempre resetea is_generating = false

---

## Fase 3: UI -- Pagina de Leccion con Motor IA

### 3A. Nueva ruta `/lesson/:lessonId`

Pagina principal de la leccion con layout de dos columnas:

**Columna izquierda (principal):**
- Header: numero de leccion, tema, estado
- PASO 1 -- Relevamiento (LessonBrief):
  - Formulario: enfoque_deseado, tipo_dinamica_sugerida, nivel_profundidad (select), observaciones_docente
  - Selector de bibliografia (Modo C): muestra curriculum_nodes disponibles del plan, permite seleccionar 2-5
  - Boton "Confirmar relevamiento" -> cambia status a READY_FOR_PRODUCTION
  - No permite avanzar sin bibliografia_confirmada
- PASO 2 -- Generacion:
  - Boton "Generar materiales" (deshabilitado si brief.status != READY_FOR_PRODUCTION o is_generating = true)
  - Spinner durante generacion
  - Vista de TeachingMaterial (cards con secciones: proposito, actividades, producto, criterios, diferenciacion, cierre)
  - Vista de ReadingMaterial (HTML renderizado + link a PDF)
  - Badges de status (GENERATED / VALIDATED / INVALIDATED)
  - Boton "Regenerar" (si lesson.status != LOCKED, maximo 2 auto-intentos)

**Columna derecha (Copiloto lateral):**
- Bibliografia usada (lista de curriculum_nodes citados)
- Indicador de que nodos fueron referenciados con data-ref
- Selector de nivel_profundidad (ajustable, dispara regeneracion)
- Boton regenerar individual (teaching o reading)
- No muestra prompts internos

### 3B. Navegacion desde Dashboard

- Las cards de cursos activos en Dashboard seran clickeables
- Nueva ruta `/course/:courseId` que lista las lessons del curso
- Cada lesson lleva a `/lesson/:lessonId`

### 3C. Invalidacion cruzada

- En UI: si se regenera TeachingMaterial, ReadingMaterial se marca INVALIDATED con badge visual
- Se ofrece regenerar ReadingMaterial automaticamente

---

## Fase 4: Validaciones Tecnicas (server-side en edge function)

Implementadas como funciones de validacion dentro del edge function:

1. **Listas prohibidas**: regex para `<ul>`, `<ol>`, `<li>`, `^\d+\.` al inicio de linea
2. **Resolucion matematica**: regex `=\s*\d+`, frases como "la solucion es", "por lo tanto x ="
3. **Cierre en Sociales**: ultimo parrafo no puede contener "En conclusion", "Por lo tanto", "En definitiva"
4. **Conteo de palabras**: strip HTML, contar palabras, validar 1000-1300
5. **Tags data-ref**: cada curriculum_node_id en bibliografia debe tener al menos 1 `<span data-ref="...">` en content_html
6. **Si falla**: regenerar automaticamente (hasta 2 veces), luego marcar INVALIDATED

---

## Secuencia de implementacion

| Orden | Tarea | Dependencia |
|-------|-------|-------------|
| 1 | Migracion DB (enums, tablas, columna, RLS, storage) | Ninguna |
| 2 | Edge function generate-materials | Migracion DB |
| 3 | Pagina /course/:courseId (lista de lessons) | Ninguna (UI) |
| 4 | Pagina /lesson/:lessonId (brief + generacion + copiloto) | Edge function |
| 5 | Navegacion Dashboard -> Course -> Lesson | Paginas creadas |
| 6 | Invalidacion cruzada + regeneracion | Edge function + UI |

---

## Archivos a crear/modificar

**Nuevos:**
- `supabase/functions/generate-materials/index.ts` -- edge function principal
- `src/pages/Course.tsx` -- lista de lessons de un curso
- `src/pages/Lesson.tsx` -- pagina principal con brief + materiales + copiloto
- `src/components/lesson/BriefForm.tsx` -- formulario PASO 1
- `src/components/lesson/BibliographySelector.tsx` -- selector Modo C
- `src/components/lesson/TeachingMaterialView.tsx` -- vista del material didactico
- `src/components/lesson/ReadingMaterialView.tsx` -- vista del material de lectura
- `src/components/lesson/CopilotPanel.tsx` -- panel lateral derecho
- `src/components/lesson/GenerateButton.tsx` -- boton con estados

**Modificados:**
- `src/App.tsx` -- agregar rutas /course/:courseId y /lesson/:lessonId
- `src/pages/Dashboard.tsx` -- hacer cards clickeables (Link a /course/:id)
- `supabase/config.toml` -- agregar [functions.generate-materials] con verify_jwt = false

