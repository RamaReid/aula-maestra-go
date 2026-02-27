

# PRD 1.2 Foundation SOD — Plan de Implementación

## Paso 1: Habilitar Backend (Lovable Cloud)
- Activar Lovable Cloud (Supabase) en región `america`
- Esto nos da: Auth, Database, RLS, Edge Functions

## Paso 2: Arquitectura de Seguridad
- Consultar al agente de seguridad para diseñar RLS correctamente
- Definir función `has_role()` security definer
- Enum `app_role` con valores `docente`, `admin`

## Paso 3: Modelo de Datos (Migración)
Crear todas las tablas en orden de dependencias:
1. `profiles` (con trigger auto-create al signup)
2. `user_roles` (separada, con enum `docente | admin`)
3. `schools` (nombre, distrito, localidad, tipo, user_created)
4. `curriculum_documents` (province, subject, cycle, year_level, status)
5. `curriculum_nodes` (árbol jerárquico: eje→unidad→bloque→contenido)
6. `courses` (con constraint único user+school+subject+year+academic_year)
7. `plans` (1 por course, status incomplete/validated)
8. `plan_objectives` (4-8 por plan)
9. `plan_content_mappings` (curriculum_node → plan)
10. `plan_lessons` (28 fijas por plan, con flags integrative/recovery)
11. `plan_lesson_content_links` (tabla puente)
12. `lessons` (28 reales por curso)
13. `lesson_shift_events` (log de cambios de fecha)

## Paso 4: Políticas RLS
- Docente: CRUD solo sobre sus propios courses, plans, lessons
- Admin: gestión de curriculum_documents, curriculum_nodes, schools oficiales
- Schools oficiales: read-only para docentes, pueden crear las propias
- Curriculum: inmutable para docentes

## Paso 5: Seed de Escuelas PBA
- Insertar escuelas representativas de Provincia de Buenos Aires
- Marcadas como `user_created = false`

## Paso 6: Auth UI (Login/Registro)
- Páginas de login y registro con email + contraseña
- Redirección post-login al dashboard
- Protección de rutas autenticadas

## Paso 7: Dashboard del Docente
- Lista de cursos activos con estado del plan
- Sección de cursos archivados (solo lectura)
- Botón para crear nuevo curso

## Paso 8: Panel Admin de Currículo
- Acceso solo para rol ADMIN
- CRUD de CurriculumDocument (crear/editar documentos verificados)
- CRUD de CurriculumNode (árbol jerárquico de contenidos)
- Vista de árbol para organizar nodos

## Paso 9: Wizard de Creación de Curso (8 pasos)
- Flujo paso a paso: Provincia → Materia → Ciclo → Año → Escuela → Tipo → Orientación/Especialidad
- Matching exacto con CurriculumDocument VERIFIED
- Validación de unicidad
- Auto-creación de Plan + 28 PlanLessons al confirmar

## Paso 10: Editor de Plan
- Secciones: Fundamentación, Objetivos, Estrategias, Evaluación marco
- Organización de contenidos (mapeo de CurriculumNodes)
- Editor de 28 PlanLessons (theme, subtitle, justification, learning_outcome)
- Asignación de contenidos a cada lección
- Botón VALIDAR con todas las validaciones bloqueantes del PRD
- Al validar: crear 28 Lessons reales automáticamente

## Paso 11: Agenda (solo si Plan VALIDATED)
- Vista lista/calendario de 28 Lessons
- Asignar/cambiar fechas, cambiar status (PLANNED → TAUGHT)
- Log automático de cambios de fecha (LessonShiftEvent)
- Botón "Iniciar 2º cuatrimestre" (bloquea edición de lecciones 1-14)

## Paso 12: Enforcement de Estados
- Lesson LOCKED: no editable
- Course ARCHIVED: todo read-only, botón para archivar

## Paso 13: Navegación del Curso
- Vista detalle con tabs: Datos del curso | Plan | Agenda
- Indicadores visuales de estado y progreso

