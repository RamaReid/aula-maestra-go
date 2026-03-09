# FEATURES IMPLEMENTED

## Landing (`/`)

- Presentacion del producto como sistema integral para docentes.
- CTAs a registro, login y demo.
- Comparacion visual de planes `FREE`, `BASICO`, `PREMIUM`.

## Demo (`/demo`)

- Caso demo cargado para `Filosofia e Historia de la Ciencia y la Tecnologia`.
- Tabs de planificacion, secuencia, preparar clase y agenda.
- Banner explicito de modo demo sin persistencia.

## Login y registro (`/login`, `/register`)

- Login por email y password.
- Registro de usuario nuevo.
- Login con Google mediante `cloud-auth-js`.
- Limpieza defensiva de query params sensibles en login.

## Dashboard (`/dashboard`)

- Carga de plan efectivo via `useEntitlements`.
- Lista cursos activos y archivados.
- Alta de nuevo curso.
- Acceso a `Sincronizar ABC`.
- Acceso a `Billing`.
- Archivado y borrado de cursos.
- Guided tour.
- Cambio QA de plan con `set-test-plan` para emails permitidos.
- Manejo explicito de errores de carga.

## Importacion curricular (`/curriculum/import`)

- Consulta de documentos curriculares verificados ya cargados.
- Filtro por materia, ciclo y año.
- Importacion desde URL oficial de `abc.gob.ar`.
- Importacion manual de PDF/archivo.
- Autocompletado inicial desde nombre de archivo.
- Invocacion de `import-curriculum-pdf`.
- Posibilidad de reutilizar un documento ya existente al ir a crear curso.

## Wizard de curso (`/course/new`)

- Wizard de 8 pasos.
- Seleccion o alta de escuela.
- Seleccion de tipo de escuela, ciclo, año y materia.
- Campos de orientacion y especialidad.
- Definicion de franjas horarias semanales.
- Resolucion automatica de curriculum con `resolve-curriculum-document`.
- Manejo de ambiguedad curricular con candidatos.
- Verificacion de limite de cursos con `check-course-limit`.
- Creacion de `course`, `course_schedule_slots`, `plan` y 28 `plan_lessons`.
- Bootstrap inicial del plan con `bootstrap-course-plan`.

## Pantalla de curso (`/course/:courseId`)

- Carga de curso, plan, lessons y curriculum.
- Visualizacion del documento curricular base.
- Tabs para planificacion, agenda y lecciones.
- Guided tour.
- Reglas diferentes por plan:
  - `FREE`: secuencia exacta de 3 clases del mismo curso
  - `BASICO/PREMIUM`: secuencias consecutivas
- Accion `Preparar seleccion` con `generate-materials`.
- Archivado del curso.

## Editor de plan anual

- Fundamentacion.
- Objetivos.
- Estrategias marco y practicas.
- Contenidos por bloques.
- Evaluacion.
- Recursos.
- Bibliografia docente.
- Clases planificadas.
- Rubricas.
- Estado del plan: `INCOMPLETE`, `VALIDATED`, `EDITED`.
- Revalidacion via RPC `validate_plan`.
- Regeneracion del borrador anual.
- Reparacion de bibliografia curricular.
- Exportacion PDF estructurada.
- Trazabilidad curricular visible como capa secundaria.

## Agenda

- Construccion de agenda desde `course_schedule_slots` + `plan_lessons`.
- Sincronizacion de `lessons` con el plan.
- Acceso a cada clase individual.

## Clase individual (`/lesson/:lessonId`)

- Carga de lesson, plan_lesson, brief y materiales.
- Vista de canon de la clase.
- Vista de nodos curriculares mapeados.
- Vista de bibliografia confirmada.
- Vista de fuentes del docente y nodos referenciados.
- Generacion individual o regeneracion.
- Overlay de progreso mientras `is_generating = true`.
- Chat del copiloto en `PREMIUM`.

## Brief docente

- Enfoque deseado.
- Tipo de dinamica sugerida.
- Nivel de profundidad.
- Observaciones del docente.
- Bibliografia confirmada.
- Fuentes autorizadas por archivo.
- Fuentes premium por URL / video / articulo / sitio / dato.
- Autocompletado con IA (`copilot-autocomplete`).

## Materiales generados

- Material didactico estructurado.
- Texto de lectura en HTML.
- Estado de material: `GENERATED`, `VALIDATED`, `INVALIDATED`, `EDITED`.
- Validacion de lectura y razones de invalidacion.
- Export PDF si corresponde.
- Fallback de descarga cuando el PDF no esta persistido.

## Billing (`/billing`)

- Lectura de suscripcion actual.
- Lectura de solicitudes manuales.
- Checkout Mercado Pago para `BASICO` y `PREMIUM`.
- Reconciliacion manual del estado de facturacion.
- Cancelacion de suscripcion automatica.
- Formulario de solicitud manual de upgrade.
- Visualizacion de limites activos segun entitlements.

## Features transversales

- Lazy loading de pantallas.
- Toasters y manejo de errores.
- Tipado fuerte con `src/integrations/supabase/types.ts`.
- Persistencia local de sesion Supabase.
- Tests automatizados basicos.
