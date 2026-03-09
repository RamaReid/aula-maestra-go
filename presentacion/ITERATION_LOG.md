# ITERATION LOG

## Criterio

Este log resume iteraciones importantes que si tienen huella verificable en el repo: commits, migraciones, docs y archivos de Lovable.

## Iteraciones tecnicas relevantes

### Iteracion 1. Flujo base de planificacion y materiales

Evidencia:

- tablas `lesson_briefs`, `teaching_materials`, `reading_materials`
- editor de plan
- RPC `validate_plan`
- `generate-materials`

Cambio:

- se paso de un flujo de curso/plan a uno que llega hasta materiales concretos por clase

### Iteracion 2. Modelo de planes y entitlements

Evidencia:

- migracion `20260227214257...`
- tablas `subscriptions`, `user_entitlements`, `usage_counters`

Cambio:

- se agregaron limites por plan y recalculo de permisos

Por que:

- soportar `FREE`, `BASICO`, `PREMIUM`

### Iteracion 3. Curriculum enlazado al curso

Evidencia:

- `courses.curriculum_document_id`
- `resolve-curriculum-document`
- `curriculum_documents` y `curriculum_nodes`

Cambio:

- el curso deja de ser una materia suelta y pasa a tener anclaje curricular trazable

### Iteracion 4. Importacion curricular mas robusta

Evidencia:

- commits sobre `curriculum import`
- `import-curriculum-pdf`
- `firecrawl-proxy-abc`
- parsing PDF con `pdfjs-serverless`

Cambio:

- se incorporaron caminos de import oficial, proxy y carga manual

Por que:

- resolver problemas reales al bajar PDFs de `abc.gob.ar`

### Iteracion 5. Autofill y mejoras UX de importacion

Evidencia:

- commit `ab0a1a6 Auto-fill fields from PDF name`
- UI de `CurriculumImport.tsx`

Cambio:

- menos friccion al cargar diseños manualmente

### Iteracion 6. Fuentes autorizadas del docente

Evidencia:

- migraciones `add_authorized_sources`
- bucket `authorized-sources`
- `process-authorized-source`
- UI en `BriefForm`

Cambio:

- el docente puede sumar archivos propios y usarlos en el motor de generacion

### Iteracion 7. Busqueda premium y seleccion guiada

Evidencia:

- migracion `add_premium_query_requests`
- `resolve-premium-query`

Cambio:

- se agrego una capa premium para buscar y aprobar recursos externos concretos

### Iteracion 8. Billing foundation

Evidencia:

- migracion `add_billing_foundation`
- `create-checkout`
- `billing-webhook`
- `reconcile-billing`
- `cancel-subscription`
- `Billing.tsx`

Cambio:

- el proyecto sumo monetizacion operativa, no solo limites estaticos

### Iteracion 9. Refresh de estructura anual

Evidencia:

- migracion `20260308121000_annual_plan_structure_refresh.sql`
- `PlanEditor.tsx`

Cambio:

- se reforzo la estructura del plan anual y la validacion de contenidos

### Iteracion 10. Sincronizacion entre plan y agenda

Evidencia:

- migracion `20260308230914_sync_lessons_with_plan_revalidation.sql`
- uso conjunto de `plan_lessons` y `lessons`

Cambio:

- el plan anual y la agenda operativa quedaron mas alineados

### Iteracion 11. Limpieza de UI del editor

Evidencia:

- `.lovable/plan.md`

Cambio:

- el detalle tecnico del anclaje curricular pasa a segundo plano visual

Por que:

- mejorar lectura para demo y uso docente sin perder trazabilidad

## Conclusiones para presentar

- El proyecto evoluciono por capas funcionales, no por una sola entrega.
- La complejidad crecio en cuatro frentes: curriculum, IA, fuentes, billing.
- Hay evidencia de refino rapido y continuo, consistente con desarrollo asistido por prompts.
