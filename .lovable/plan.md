

## Plan: Copiloto IA conversacional + autocompletado inteligente

### Contexto

El CopilotPanel actual es un dashboard estatico de diagnostico. El usuario quiere dos cosas:
1. **Chat conversacional** donde el docente consulte al copiloto sobre su clase, curriculum, bibliografia, y reciba respuestas contextualizadas.
2. **Autocompletado inteligente** del BriefForm (enfoque, dinamica, observaciones) usando IA con contexto real de la clase.

Ya existe `LOVABLE_API_KEY` configurado y la infraestructura de Lovable AI Gateway. Ya existe `buildBriefAutocompleteDraft()` en BriefForm pero es puramente heuristico (sin IA).

### Parte 1: Edge Function `copilot-chat`

Crear `supabase/functions/copilot-chat/index.ts`:
- Recibe `{ messages, lessonContext }` donde `lessonContext` incluye: theme, learningOutcome, canonOperation, canonEvidence, briefFocus, briefDynamic, bibliographyNames, curriculumNodeNames, authorizedSourceTitles, teachingStatus, readingStatus, depthLevel, subject, yearLevel.
- Construye un system prompt especializado en pedagogia argentina que conoce el contexto completo de la clase.
- Usa Lovable AI Gateway con `google/gemini-3-flash-preview` en modo streaming.
- Maneja errores 429/402 con mensajes claros.

### Parte 2: Edge Function `copilot-autocomplete`

Crear `supabase/functions/copilot-autocomplete/index.ts`:
- Recibe `{ lessonContext }` (mismo contexto que el chat).
- Usa tool calling para extraer output estructurado: `{ enfoque, dinamica, profundidad, observaciones }`.
- Modelo: `google/gemini-3-flash-preview` sin streaming.
- El prompt instruye al modelo a generar indicaciones pedagogicas concretas basadas en el contexto curricular, la bibliografia disponible y el canon de la clase.

### Parte 3: Chat UI en el CopilotPanel

Modificar `src/components/lesson/CopilotPanel.tsx`:
- Agregar una seccion de chat al final del panel (o como tab principal si premium).
- Input de texto + lista de mensajes con scroll.
- Renderizar respuestas con markdown (instalar `react-markdown`).
- Streaming token-by-token usando fetch + SSE parsing.
- El contexto de la clase se envia automaticamente con cada mensaje (el docente no necesita repetir info).
- Limitar a premium (`copilotoMode === "full"`); en basico mostrar mensaje de upgrade.

### Parte 4: Boton "Autocompletar con IA" en BriefForm

Modificar `src/components/lesson/BriefForm.tsx`:
- Agregar boton "Autocompletar con IA" (icono Sparkles) visible solo cuando `auto_complete_forms_enabled === true` (PREMIUM).
- Al hacer clic, llama a `copilot-autocomplete` con el contexto de la clase.
- Pre-llena los campos enfoque, dinamica, profundidad y observaciones con la respuesta.
- El docente puede editar despues del autocompletado.
- Mostrar estado de carga con spinner.
- Reemplazar el `buildBriefAutocompleteDraft()` heuristico actual por este boton (mantener el heuristico como fallback si la IA falla).

### Parte 5: Config TOML + dependencia

- Agregar ambas funciones a `supabase/config.toml` con `verify_jwt = false`.
- Instalar `react-markdown` para renderizar respuestas del chat.

### Archivos nuevos
- `supabase/functions/copilot-chat/index.ts`
- `supabase/functions/copilot-autocomplete/index.ts`

### Archivos modificados
- `src/components/lesson/CopilotPanel.tsx` — Agregar seccion de chat con streaming
- `src/components/lesson/BriefForm.tsx` — Boton autocompletar con IA
- `supabase/config.toml` — Registrar nuevas funciones

### Seguridad
- Ambas edge functions validan JWT del usuario.
- No se exponen secrets al cliente.
- El contexto se construye server-side consultando la DB para evitar manipulacion.

