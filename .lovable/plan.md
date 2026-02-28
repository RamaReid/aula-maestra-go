

# PRD-V1 — INFORME DE VERIFICACION INTEGRAL DEL SOD

## Estado General: PARCIALMENTE APROBADO — 14 grietas detectadas

---

## 1. PRD 1.2 — Foundation

### 1.1 Wizard de Curso
**Estado: NO IMPLEMENTADO**

No existe pagina de creacion de curso (Wizard). El boton "Nuevo curso" en Dashboard llama a `check-course-limit` pero el `TODO` en linea 79 de Dashboard.tsx dice "navigate to course creation when implemented". No hay ruta `/course/new` ni formulario Wizard.

**Grietas:**
- GRIETA F-1: No hay Wizard de 8 pasos (PBA fija, Materia, Ciclo, Anio, Orientacion, Escuela, etc.)
- GRIETA F-2: No se valida bloqueo de orientacion en BASIC ni exigencia de especialidad en Tecnica UPPER
- GRIETA F-3: No se crean automaticamente 28 PlanLessons al crear Plan
- GRIETA F-4: No hay logica de creacion de Plan automatica al crear Course

### 1.2 Planificacion
**Estado: PARCIAL**

Las tablas `plans`, `plan_lessons`, `plan_objectives`, `plan_content_mappings` existen. Sin embargo:

- GRIETA F-5: No hay UI de edicion de Plan (fundamentacion, estrategias, evaluacion_marco)
- GRIETA F-6: No hay validacion de Plan (4-8 propositos, coverage completo, fundamentacion minima)
- GRIETA F-7: No hay boton "Validar Plan" que cambie status a VALIDATED y cree Lessons reales
- GRIETA F-8: No hay Agenda (no se mencionan scheduled_date en ninguna UI)

### 1.3 Estados Estructurales
**Estado: CORRECTO en DB, parcial en UI**

- Los enums `plan_status`, `lesson_status`, `course_status` existen correctamente
- GRIETA F-9: ARCHIVED no se gestiona en UI (no hay boton para archivar curso). Course.tsx no bloquea acciones en modo ARCHIVED
- La generacion IA SI bloquea LOCKED correctamente (linea 349 de generate-materials)

---

## 2. PRD 2.3 — Motor IA

### 2.1 PASO 1 Obligatorio
**Estado: CORRECTO**

- Brief debe estar READY_FOR_PRODUCTION o PRODUCED (linea 425)
- bibliografia_confirmada debe tener al menos 1 elemento (linea 431)
- BibliographySelector filtra correctamente por plan_content_mappings del curso (Modo C)
- Limite de 5 fuentes maximo validado en frontend

### 2.2 TeachingMaterial
**Estado: CORRECTO**

- Tool call fuerza estructura: purpose, activities, expected_product, achievement_criteria, differentiation, closure
- Status se setea como VALIDATED directamente (linea 563)
- Al regenerar teaching, reading se invalida automaticamente (linea 569-573)

**Grieta menor:**
- GRIETA M-1: TeachingMaterial no tiene validacion de reintentos. Si la AI devuelve basura, se guarda igual como VALIDATED. No hay validacion estructural post-AI (verificar que activities no este vacio, que purpose tenga contenido, etc.)

### 2.3 ReadingMaterial
**Estado: CORRECTO**

Validaciones implementadas:
- Listas HTML: regex correcto `<ul\b`, `<ol\b`, `<li\b`
- Listas numeradas en texto: `^\d+\./m`
- Resolucion matematica: `= \d+` y frases prohibidas
- Cierre en Sociales: 5 frases prohibidas en ultimo parrafo real (extraido con regex `<p>...</p>`)
- Conteo de palabras: 1000-1300
- Tags data-ref: verificados para cada nodo de bibliografia

**GRIETA M-2:** No se valida ausencia de subtitulos (`<h1>`, `<h2>`, `<h3>`, etc.). El PRD exige "sin subtitulos" pero el regex no lo verifica.

### 2.4 PDF Server-Side
**Estado: CORRECTO**

- pdf-lib importado correctamente
- A4 (595.28 x 841.89), Helvetica, 12pt, interlineado 1.2 (14.4pt), margenes 72pt
- Word-wrap con `font.widthOfTextAtSize()`
- Validacion de paginas 2-4
- Reintentos: max 3 intentos (correcto)
- Tags `<span data-ref>` eliminados antes de renderizar PDF

### 2.5 Concurrencia
**Estado: PARCIALMENTE CORRECTO**

- `is_generating` se setea antes de generar y se resetea en catch (linea 742)
- Se valida `is_generating` antes de iniciar (linea 342)
- GRIETA M-3: No hay proteccion real contra race condition. Dos requests simultaneos podrian pasar la verificacion `is_generating === false` antes de que cualquiera la setee a `true`. Se necesitaria un UPDATE con WHERE is_generating = false y verificar affected rows.

---

## 3. PRD 3 — Planes y Gating

### 3.1 Tablas y Triggers
**Estado: CORRECTO**

- `subscriptions`, `user_entitlements`, `usage_counters` creadas correctamente
- Trigger `on_auth_user_created` inserta subscription FREE + entitlements + counter
- Trigger `on_subscription_plan_change` recalcula entitlements automaticamente
- Funcion `recalculate_entitlements` con valores hardcodeados correctos
- Funcion `upgrade_user_plan` disponible
- RLS correcto: SELECT only para owner en las 3 tablas
- Constraints UNIQUE en user_id en las 3 tablas

### 3.2 Gating Server-Side
**Estado: CORRECTO CON GRIETAS**

- Sesiones semanales validadas (linea 320)
- Lazy weekly reset implementado (linea 310)
- Clases por sesion validadas (linea 369-386)

**GRIETA G-1:** La validacion de clases por sesion (linea 369-386) cuenta teaching_materials VALIDATED de TODA la semana para TODO el curso, no por "sesion". El PRD dice "3 clases por sesion" pero la implementacion cuenta todas las clases de la semana del curso. Si el usuario genera 3 en lunes y quiere 3 mas el martes, esta bloqueado. Esto es semanticamente incorrecto: `max_classes_per_session` deberia limitar cuantas lessons se pueden generar en una sola invocacion, no un acumulado semanal.

**GRIETA G-2:** No hay endpoint multi-lesson. El PRD requiere `{ "lesson_ids": ["id1","id2","id3"], "mode": "full_session" }`. Actualmente el endpoint solo acepta un `lesson_id` por vez. No hay concepto de "sesion" como agrupacion de lessons.

**GRIETA G-3:** El contador `sessions_used_this_week` se incrementa por cada lesson VALIDATED individual (linea 720-724), no por sesion. Si el usuario genera 3 lessons individuales, el contador sube 3 en vez de 1.

### 3.3 Watermark
**Estado: CORRECTO**

- Se aplica cuando `watermark_enabled === true` (linea 654)
- Texto "DEMO - Plan Gratuito", 48pt, opacidad 0.08, rotado 45 grados
- 3 repeticiones por pagina (25%, 50%, 75% del alto)
- Se aplica despues de validar paginas, antes de subir/devolver

### 3.4 Persistencia Condicional
**Estado: CORRECTO**

- Si `persistent_storage_enabled === false`: devuelve base64, no sube a storage, pdf_url queda null
- Si `persistent_storage_enabled === true`: sube a bucket, guarda pdf_url
- Frontend maneja `pdfBase64` correctamente con blob URL temporal

### 3.5 Frontend Entitlements
**Estado: CORRECTO**

- Hook `useEntitlements` con polling 30s
- Badge de plan en Dashboard
- CopilotPanel deshabilitado si `copiloto_mode === "none"`
- ReadingMaterialView muestra PDF temporal para FREE

### 3.6 Upgrade en Caliente
**Estado: CORRECTO**

- Trigger `on_subscription_plan_change` recalcula automaticamente
- `useEntitlements` con polling 30s detecta cambios
- No requiere logout

---

## 4. Seguridad

### 4.1 RLS
**Estado: CORRECTO**

- Todas las tablas tienen RLS habilitado
- Lessons, briefs, materials protegidos con funciones `is_lesson_owner`, `is_course_owner`
- subscriptions, user_entitlements, usage_counters: solo SELECT para owner, sin mutaciones cliente
- Edge functions usan `getClaims()` para auth (no `verify_jwt`)

### 4.2 Gating Server-Side
**Estado: CORRECTO**

- Entitlements se leen server-side con adminClient
- No se confian valores del frontend
- check-course-limit valida server-side

**GRIETA S-1:** `supabase/config.toml` NO tiene las secciones `[functions.generate-materials]` ni `[functions.check-course-limit]` con `verify_jwt = false`. Solo tiene `project_id`. Esto funciona en Lovable Cloud porque verify_jwt defaults a las signing keys, pero la configuracion explicita estaria mas limpia.

---

## 5. Consistencia de Estados

**GRIETA C-1:** `teaching_materials.status` tiene default `'GENERATED'::material_status` en la DB pero el edge function setea directamente `VALIDATED`. El status `GENERATED` nunca se usa como resultado final, lo cual es correcto, pero el enum y el default son vestigios que podrian confundir.

**GRIETA C-2:** No hay validacion que prevenga Reading VALIDATED con pdf_url null en PREMIUM. Si el upload a storage falla silenciosamente, el status podria quedar VALIDATED sin pdf_url. El codigo actual tira exception si el PDF falla (linea 686-689), asi que este escenario es poco probable pero no imposible (upload exitoso pero getPublicUrl falla).

---

## 6. Resumen de Grietas

### Criticas (bloquean el uso real del sistema)
| ID | Modulo | Descripcion |
|----|--------|-------------|
| F-1 a F-8 | Foundation | No hay Wizard, no hay edicion/validacion de Plan, no hay Agenda |
| G-2 | Gating | No hay endpoint multi-lesson session |
| G-1/G-3 | Gating | Semantica de "sesion" vs "lesson individual" incorrecta en contadores |

### Moderadas (afectan integridad pero no bloquean flujo basico)
| ID | Modulo | Descripcion |
|----|--------|-------------|
| M-2 | Motor IA | No se validan subtitulos HTML en ReadingMaterial |
| M-3 | Motor IA | Race condition en is_generating (no atomico) |
| M-1 | Motor IA | TeachingMaterial no tiene validacion post-AI |

### Menores (mejoras recomendadas)
| ID | Modulo | Descripcion |
|----|--------|-------------|
| F-9 | Foundation | No hay gestion de ARCHIVED en UI |
| S-1 | Seguridad | config.toml sin verify_jwt explicito |
| C-1 | Consistencia | Default GENERATED nunca usado |
| C-2 | Consistencia | Posible VALIDATED sin pdf_url en edge case |

---

## 7. Plan de Remediacion Sugerido (orden de prioridad)

1. **PRD 4 - Multi-lesson Session**: Crear endpoint que acepte array de lesson_ids, validar 1-3, mismo curso, mismo usuario, incrementar counter solo 1 vez. Corregir semantica de `max_classes_per_session`.

2. **PRD 1.2 Completion**: Implementar Wizard de curso, edicion de Plan, validacion de Plan, y Agenda. Esto es el 60% del sistema que falta.

3. **Validacion M-2**: Agregar `/<h[1-6]\b/i` al pipeline de validacion de ReadingMaterial.

4. **Race condition M-3**: Cambiar el check de is_generating a un UPDATE atomico: `UPDATE lessons SET is_generating = true WHERE id = X AND is_generating = false` y verificar que se afecto 1 row.

5. **Validacion M-1**: Agregar chequeos basicos post-AI para TeachingMaterial (purpose no vacio, activities.length > 0, etc.)

---

## 8. Veredicto

El motor IA (PRD 2.3) y el sistema de planes/gating (PRD 3) estan solidos y bien implementados. Las grietas criticas son:

1. **Foundation incompleta**: El Wizard, la edicion/validacion de Plan y la Agenda no existen en UI. Las tablas estan, pero no hay flujo de usuario.

2. **Sesion multi-lesson no existe**: El concepto de "sesion = 1-3 lessons juntas" no esta implementado. Cada lesson se genera individualmente y el contador se incrementa por lesson, no por sesion.

Recomendacion: Priorizar el endpoint multi-lesson (correccion rapida al edge function) y luego abordar PRD 1.2 completion como siguiente sprint.

