

# Plan de Implementación — PRD 1.2 Foundation SOD

## Visión General
Sistema operativo para docentes de secundaria en Provincia de Buenos Aires. Centraliza planificación, agenda y trazabilidad curricular. Sin IA, sin exportaciones, sin monetización.

---

## Fase 1: Base de Datos, Autenticación y Seguridad

### 1.1 — Autenticación y Perfiles
- Login/registro con Supabase Auth (email + contraseña)
- Tabla `profiles` (name, email) con trigger auto-create al signup
- Tabla `user_roles` con enum `DOCENTE | ADMIN` (separada de profiles por seguridad)
- Función `has_role()` security definer para RLS sin recursión

### 1.2 — Modelo de Datos Completo
Crear todas las tablas con constraints según PRD:
- **Schools**: official_name, district, locality, school_type (COMUN|TECNICA), source_url, user_created
- **CurriculumDocument**: province (PBA fijo), subject, cycle (BASIC|UPPER), year_level, status (VERIFIED|DEPRECATED), content_hash, official_url
- **CurriculumNode**: árbol multinivel (EJE|UNIDAD|BLOQUE|CONTENIDO), parent_id, order_index
- **Course**: con constraint único (user_id, school_id, subject, year_level, academic_year), status ACTIVE|ARCHIVED
- **Plan**: único por course, status INCOMPLETE|VALIDATED, campos fundamentacion/estrategias/evaluacion_marco, second_term_started
- **PlanObjective**: 4-8 por plan, min 20 chars
- **PlanContentMapping**: mapeo curriculum_node_id único por plan
- **PlanLesson**: 28 fijas por plan, con campos theme/subtitle/justification/learning_outcome
- **PlanLessonContentLink**: tabla puente para cobertura de contenidos
- **Lesson**: 28 reales por curso, status PLANNED|TAUGHT|RESCHEDULED|LOCKED
- **LessonShiftEvent**: log automático de cambios de fecha

### 1.3 — Políticas RLS
- DOCENTE: solo ve/edita sus propias entidades (courses, plans, lessons)
- ADMIN: acceso a catálogos (CurriculumDocument, CurriculumNode, Schools oficiales)
- Schools oficiales: solo lectura para docentes; pueden crear las propias
- CurriculumDocument/Nodes: inmutables para docentes

---

## Fase 2: Seed de Escuelas PBA

- Carga inicial de escuelas oficiales de Provincia de Buenos Aires con datos representativos (nombre, distrito, localidad, tipo)
- Marcadas como `user_created = false` (no editables por docentes)

---

## Fase 3: Admin de Currículo

### Panel Admin mínimo
- CRUD de **CurriculumDocument** (crear/editar documentos curriculares verificados)
- CRUD de **CurriculumNode** (crear árbol de contenidos: ejes → unidades → bloques → contenidos)
- Solo accesible para usuarios con rol ADMIN
- Vista de árbol para organizar nodos jerárquicamente

---

## Fase 4: Wizard de Creación de Curso

### Wizard paso a paso (8 pasos)
1. Provincia → PBA (fija, no editable)
2. Materia (subject)
3. Ciclo (BASIC | UPPER)
4. Año (year_level 1-6)
5. Escuela (buscar en seed + opción de crear nueva)
6. Tipo de escuela (COMUN | TECNICA)
7. Orientación (solo si UPPER + COMUN)
8. Especialidad (solo si UPPER + TECNICA)

### Validaciones bloqueantes
- Matching exacto de CurriculumDocument VERIFIED con province + subject + cycle + year_level
- Si no hay match → no se puede crear el curso, se muestra mensaje claro
- Constraint de unicidad: no duplicar (user_id, school_id, subject, year_level, academic_year)

### Auto-creación al confirmar
- Se crea el Course con status ACTIVE
- Se crea automáticamente 1 Plan (status INCOMPLETE)
- Se crean automáticamente 28 PlanLessons vacías (numeradas 1-28, term 1 o 2, con flags is_integrative_evaluation para 13/27 e is_recovery para 14/28)

---

## Fase 5: Editor de Plan

### Secciones editables
- **Fundamentación**: editor de texto, mínimo 600 chars y 4 párrafos
- **Objetivos**: lista editable de 4-8 objetivos, mínimo 20 chars cada uno, sin duplicados
- **Estrategias metodológicas**: marco narrativo (min 300 chars) + lista de prácticas (min 4 items)
- **Evaluación marco**: texto libre, mínimo 250 chars
- **Organización de contenidos**: mapear CurriculumNodes al plan (reordenar/agrupar, no renombrar)

### Editor de PlanLessons (28)
- Cada PlanLesson editable: theme, subtitle, justification, learning_outcome
- Asignar contenidos (PlanLessonContentLink) a cada lección
- Visualización clara de term 1 (1-14) y term 2 (15-28)

### Botón "VALIDAR Plan"
Validaciones bloqueantes antes de pasar a VALIDATED:
- Fundamentación cumple mínimos
- 4-8 objetivos válidos
- Estrategias con marco + prácticas
- Evaluación marco con mínimo de caracteres
- Todos los PlanContentMapping asignados a al menos 1 PlanLesson
- Todas las PlanLessons con campos mínimos completados

### Al validar exitosamente
- Plan pasa a status VALIDATED
- Se crean automáticamente 28 Lessons reales (una por PlanLesson) con fechas vacías
- Se habilita la Agenda

---

## Fase 6: Agenda (solo si Plan VALIDATED)

### Vista de Agenda
- Lista/calendario de las 28 Lessons del curso
- Cada Lesson muestra: número, tema (heredado de PlanLesson), fecha programada, status
- Asignar/cambiar fechas a cada Lesson
- Cambiar status: PLANNED → TAUGHT
- Al cambiar fecha se crea automáticamente un LessonShiftEvent (log)

### Regla del 2º cuatrimestre
- Botón "Iniciar 2º cuatrimestre" (acción explícita)
- Al activar: PlanLessons 1-14 pasan a read-only en el editor de Plan
- Solo se pueden editar PlanLessons 15-28

---

## Fase 7: Enforcement de Estados

### Lesson LOCKED
- Una Lesson puede marcarse como LOCKED
- LOCKED = no editable (fecha, status, contenido)

### Course ARCHIVED
- Botón para archivar curso (no borrar)
- ARCHIVED = todo read-only (Plan, PlanLessons, Lessons, Agenda)
- No se pueden crear nuevas Lessons ni revalidar Plan

---

## Fase 8: Dashboard y Navegación

### Dashboard principal del docente
- Lista de cursos activos con estado del plan (INCOMPLETE/VALIDATED)
- Acceso rápido a cada curso → Plan o Agenda según estado
- Cursos archivados visibles en sección separada (solo lectura)

### Navegación del curso
- Vista detalle del curso con tabs/secciones: Datos del curso | Plan | Agenda
- Indicadores visuales de estado y progreso

