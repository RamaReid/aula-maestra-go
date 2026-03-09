# DATA MODEL

## Criterio

Este resumen sale de migraciones, types generados de Supabase y queries del frontend. Cuando una relacion esta declarada en schema, se presenta como tal. Cuando solo se usa desde la app, se describe como relacion operativa.

## 1. Identidad y planes

### `profiles`

Perfil publico del usuario autenticado.

Campos usados:

- `id`
- `email`
- `name`

### `subscriptions`

Suscripcion efectiva del usuario.

Campos clave:

- `user_id`
- `plan_type`
- `status`
- `provider`
- `provider_subscription_id`
- `current_period_start`
- `current_period_end`
- `cancel_at_period_end`
- `last_payment_status`

Relacion declarada:

- una fila por usuario

### `user_entitlements`

Limites y capacidades operativas que la UI consume.

Campos clave:

- `max_courses`
- `max_weekly_sessions`
- `max_classes_per_session`
- `watermark_enabled`
- `history_enabled`
- `copiloto_mode`
- `auto_complete_forms_enabled`
- `persistent_storage_enabled`

### `usage_counters`

Contador semanal para limites de uso.

Campos clave:

- `user_id`
- `week_start_date`
- `sessions_used_this_week`

### `manual_payment_requests`

Solicitudes manuales de upgrade.

Campos clave:

- `user_id`
- `requested_plan`
- `requested_provider`
- `status`
- `billing_name`
- `tax_id`
- `proof_storage_path`

### `billing_events`

Audit log de checkout, webhook, reconciliacion y cancelacion.

Campos clave:

- `user_id`
- `provider`
- `event_type`
- `provider_event_id`
- `provider_subscription_id`
- `payload`
- `status`
- `error_message`

## 2. Contexto escolar y curriculum

### `schools`

Instituciones disponibles o creadas por el usuario.

Campos usados:

- `official_name`
- `district`
- `locality`
- `school_type`
- `created_by`
- `user_created`

### `curriculum_documents`

Documento curricular base.

Campos clave:

- `subject`
- `cycle`
- `year_level`
- `province`
- `school_type`
- `orientation`
- `speciality`
- `official_title`
- `official_url`
- `source_provider`
- `raw_text`
- `status`

### `curriculum_nodes`

Nodos estructurados del documento curricular.

Campos clave:

- `curriculum_document_id`
- `parent_id`
- `node_type`
- `name`
- `order_index`

Relacion declarada:

- muchos nodos por documento curricular
- arbol via `parent_id`

### `courses`

Curso creado por el docente.

Campos clave:

- `user_id`
- `school_id`
- `subject`
- `year_level`
- `academic_year`
- `orientation`
- `speciality`
- `curriculum_document_id`
- `status`

Relaciones declaradas:

- `school_id -> schools.id`
- `curriculum_document_id -> curriculum_documents.id`

### `course_schedule_slots`

Franjas semanales de cursada.

Campos usados:

- `course_id`
- `day_of_week`
- `start_time`
- `end_time`
- `module_count`
- `order_index`

## 3. Planificacion anual

### `plans`

Plan anual del curso.

Campos clave:

- `course_id`
- `fundamentacion`
- `estrategias_marco`
- `estrategias_practicas`
- `evaluacion_marco`
- `resources`
- `bibliografia_curso`
- `status`

Relacion operativa principal:

- un plan por curso en el flujo actual

### `plan_objectives`

Objetivos del plan.

Campos usados:

- `plan_id`
- `description`
- `order_index`

### `plan_content_blocks`

Bloques de contenido del plan.

Campos clave:

- `plan_id`
- `title`
- `description`
- `topics`
- `term`
- `order_index`

### `plan_content_mappings`

Mapeo entre el plan y nodos curriculares.

Campos clave:

- `plan_id`
- `curriculum_node_id`
- `order_index`

### `plan_lessons`

Clases del plan anual.

Campos clave:

- `plan_id`
- `content_block_id`
- `lesson_number`
- `term`
- `theme`
- `subtitle`
- `justification`
- `learning_outcome`
- `activities_summary`
- `is_integrative_evaluation`
- `is_recovery`

### `plan_lesson_content_links`

Vinculo N:N entre clases del plan y mapeos curriculares.

Campos clave:

- `plan_lesson_id`
- `plan_content_mapping_id`

### `plan_rubrics`

Rubricas de evaluacion del plan.

Campos clave:

- `plan_id`
- `content_block_id`
- `criterion_name`
- `focus_note`
- `advanced_level`
- `expected_level`
- `basic_level`
- `initial_level`

### `plan_teacher_bibliography_entries`

Bibliografia docente cargada en el plan.

Campos clave:

- `plan_id`
- `citation`
- `usage_notes`
- `order_index`

## 4. Ejecucion de clases

### `lessons`

Instancia operativa de una clase.

Campos clave:

- `course_id`
- `plan_lesson_id`
- `lesson_number`
- `scheduled_date`
- `status`
- `is_generating`

Relaciones declaradas:

- `course_id -> courses.id`
- `plan_lesson_id -> plan_lessons.id`

### `lesson_briefs`

Brief docente de la clase.

Campos clave:

- `lesson_id`
- `enfoque_deseado`
- `tipo_dinamica_sugerida`
- `nivel_profundidad`
- `observaciones_docente`
- `bibliografia_confirmada`
- `authorized_source_ids`
- `status`

Relacion declarada:

- uno a uno con `lessons`

### `teaching_materials`

Salida didactica estructurada.

Campos clave:

- `lesson_id`
- `purpose`
- `activities`
- `expected_product`
- `achievement_criteria`
- `differentiation`
- `closure`
- `status`

### `reading_materials`

Texto de lectura generado y exportable.

Campos clave:

- `lesson_id`
- `word_count`
- `content_html`
- `pdf_url`
- `status`
- `validation_reasons`

## 5. Fuentes premium y autorizadas

### `authorized_sources`

Fuentes que la app permite usar en prompts.

Campos clave:

- `course_id`
- `created_by`
- `origin_type`
- `plan_scope`
- `media_type`
- `title`
- `source_url`
- `storage_path`
- `mime_type`
- `status`
- `extracted_text`
- `summary_text`
- `metadata`

### `authorized_source_targets`

A que alcance se aplica una fuente.

Campos clave:

- `source_id`
- `target_type`
- `lesson_id`
- `sequence_key`

### `premium_query_requests`

Trazabilidad de consultas premium y candidatos devueltos.

Campos clave:

- `course_id`
- `lesson_id`
- `raw_query`
- `normalized_query`
- `corrected_query`
- `requested_resource_type`
- `target_entity`
- `target_topic`
- `status`
- `resolved_candidates`
- `selected_candidate`

## 6. Telemetria de IA

### `ai_usage_logs`

Registro de consumo IA.

Campos clave:

- `user_id`
- `course_id`
- `lesson_id`
- `feature`
- `model`
- `prompt_tokens`
- `completion_tokens`
- `total_tokens`
- `duration_ms`
- `cost_usd`

## 7. Buckets de storage

### `reading-materials-pdf`

- PDFs de material de lectura
- bucket publico para lectura

### `authorized-sources`

- archivos subidos por docentes
- acceso autenticado

## 8. Enums importantes

- `plan_type`: `FREE`, `BASICO`, `PREMIUM`
- `subscription_status`: `ACTIVE`, `CANCELED`, `EXPIRED`
- `plan_status`: `INCOMPLETE`, `VALIDATED`, `EDITED`
- `lesson_status`: `PLANNED`, `TAUGHT`, `RESCHEDULED`, `LOCKED`
- `brief_status`: `IN_PROGRESS`, `READY_FOR_PRODUCTION`, `PRODUCED`
- `material_status`: `GENERATED`, `VALIDATED`, `INVALIDATED`, `EDITED`
- `copiloto_mode`: `none`, `limited`, `full`
