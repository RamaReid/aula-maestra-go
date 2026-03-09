# PROMPT HISTORY

## Alcance

El repo no contiene un transcript completo de todas las conversaciones usadas para construir la app. Por eso este archivo no inventa prompts faltantes. Solo resume evidencia verificable encontrada en:

- `.lovable/plan.md`
- documentos `docs/PRD_*`
- `docs/CONTEXTO_IA_PROMPTS_Y_VALIDACIONES.md`
- mensajes de commit
- prompts embebidos en edge functions

## Evidencia verificable de construccion por prompts

### 1. Iteraciones guardadas por Lovable

En `.lovable/plan.md` hay una instruccion clara para refinar la UI del editor anual:

- ocultar la trazabilidad curricular cruda
- relegarla a una capa tecnica expandible
- mantener intacta la funcionalidad

Esto demuestra una iteracion de producto orientada por prompt, no solo una refactorizacion tecnica.

### 2. PRDs y documentos de instruccion presentes en el repo

El repo incluye PRDs y context packs que funcionan como prompts o insumos de implementacion:

- `PRD_LOVABLE_CORE_FLOW.md`
- `PRD_LOVABLE_ABC_ONLY_CURRICULUM.md`
- `PRD_BILLING_FOUNDATION.md`
- `PRD_LOVABLE_SUPABASE_AI_AUDIT.md`
- `PRD_LOVABLE_CURRICULUM_BIBLIOGRAPHY_REPAIR.md`
- `PRD_LOVABLE_ENV_BASE.md`

Lo que muestran:

- el producto fue guiado por entregables conversacionales / especificaciones cortas
- hubo fases separadas para curriculum, IA, billing y entorno

### 3. Prompts de ejecucion en produccion

La app tambien contiene prompts reales que no construyen la app, pero si la operan:

- `bootstrap-course-plan` define el prompt del plan anual
- `generate-materials` define prompts para material didactico y lectura
- `copilot-autocomplete` define el prompt del brief automatico
- `copilot-chat` define el system prompt del chat docente

Esto es importante para la presentacion porque la complejidad no esta solo en la UI: tambien hay ingenieria de prompts dentro del producto.

### 4. Evidencia en commits

Los commits recientes muestran temas de refinamiento que probablemente nacieron como pedidos conversacionales:

- armonizar importacion curricular
- integrar Firecrawl para PDFs de ABC
- autocompletar campos desde nombre de PDF
- habilitar uploads manuales en planes gratis
- corregir `pdfjs-serverless`
- guardar cambios del plan desde Lovable

## Resumen util para el hackathon

La evidencia real del repo permite decir que el proyecto fue desarrollado con un flujo de `Vibe Coding` / iteracion por prompts, pero **no** permite reconstruir palabra por palabra cada conversacion. La forma correcta de presentarlo es:

- hubo iteraciones cortas y frecuentes
- Lovable dejo trazas explicitas en `.lovable/plan.md`
- los PRDs del repo funcionan como prompt artifacts
- la app contiene prompts operativos en el backend

## Lo que no aparece en el repo

- historial completo de chat
- timestamps de cada prompt
- autor humano exacto de cada instruccion

Para el documento tecnico conviene presentar esto como `evidencia de iteracion asistida por IA`, no como un transcript exhaustivo.
