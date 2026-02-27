
# Completar PRD 2 - Pendientes

## 3 funcionalidades pendientes

### 1. Regeneracion selectiva (solo lectura sin tocar didactico)

**Problema actual:** Ambos botones del Copiloto ("Material didactico" y "Material de lectura") llaman a `handleGenerate()` que regenera TODO. El PRD dice que regenerar lectura no deberia tocar el material didactico.

**Solucion:**
- Agregar parametro `regenerate_only?: "teaching" | "reading"` al body del edge function `generate-materials`
- Si `regenerate_only === "reading"`, saltar la generacion de teaching material y solo regenerar reading
- Si `regenerate_only === "teaching"`, regenerar teaching, invalidar reading existente, y regenerar reading tambien (cascada)
- Sin parametro: comportamiento actual (genera ambos)
- En `Lesson.tsx`, `handleRegenerateReading` pasa `{ lesson_id, regenerate_only: "reading" }` y no resetea el brief a READY_FOR_PRODUCTION (ya esta PRODUCED, solo necesita regenerar)
- En `Lesson.tsx`, `handleRegenerateTeaching` pasa `{ lesson_id, regenerate_only: "teaching" }` (la cascada de invalidar reading la hace el edge function)

**Archivos:**
- `supabase/functions/generate-materials/index.ts` -- agregar logica condicional segun `regenerate_only`
- `src/pages/Lesson.tsx` -- pasar parametro en cada handler

### 2. Feedback de validacion en UI

**Problema actual:** Cuando el reading material queda `INVALIDATED` despues de 3 intentos, el docente solo ve el badge "Invalidado" sin saber por que.

**Solucion:**
- Agregar columna `validation_reasons text[] default '{}'` a `reading_materials` via migracion
- En el edge function, guardar `lastReasons` en esa columna al hacer upsert
- En `ReadingMaterialView.tsx`, mostrar un alert/banner con las razones cuando `status === "INVALIDATED"` y hay razones

**Archivos:**
- Migracion SQL: agregar columna `validation_reasons`
- `supabase/functions/generate-materials/index.ts` -- guardar razones en upsert
- `src/components/lesson/ReadingMaterialView.tsx` -- mostrar razones

### 3. Generacion de PDF

**Problema actual:** `pdf_url` siempre es null. El bucket `reading-materials-pdf` ya existe.

**Solucion:**
- Generar PDF del lado del cliente usando la API nativa del navegador (window.print con CSS de impresion), ya que generar PDFs en Deno edge functions es complejo y poco confiable
- Agregar boton "Descargar PDF" en `ReadingMaterialView` que abre el contenido HTML en una ventana optimizada para impresion/guardado como PDF
- Alternativa: usar una libreria ligera como `html2canvas` + `jsPDF` del lado del cliente para generar el PDF y subirlo al bucket

Dado la complejidad de PDF server-side en Deno, la solucion mas pragmatica es **client-side print-to-PDF** con un boton dedicado. No requiere cambios en el backend.

**Archivos:**
- `src/components/lesson/ReadingMaterialView.tsx` -- agregar boton de descarga/impresion PDF

---

## Secuencia de implementacion

1. Migracion: agregar columna `validation_reasons` a `reading_materials`
2. Edge function: agregar `regenerate_only` y guardar `validation_reasons`
3. `Lesson.tsx`: pasar parametro correcto en cada handler de regeneracion
4. `ReadingMaterialView.tsx`: mostrar razones de invalidacion + boton PDF print

## Detalle tecnico

### Edge function - cambios clave

```text
// Aceptar regenerate_only del body
const { lesson_id, regenerate_only } = body;

// Aceptar brief en PRODUCED ademas de READY_FOR_PRODUCTION para regeneracion selectiva
if (brief.status !== "READY_FOR_PRODUCTION" && brief.status !== "PRODUCED") { ... }

// Condicional de generacion
if (regenerate_only !== "reading") {
  // generar teaching material
}
if (regenerate_only !== "teaching") {
  // generar reading material  
}

// Solo actualizar brief a PRODUCED si no es regeneracion selectiva de reading
```

### Lesson.tsx - handlers corregidos

```text
handleRegenerateTeaching:
  - Llama edge function con { lesson_id, regenerate_only: "teaching" }
  - No manipula brief status manualmente

handleRegenerateReading:
  - Llama edge function con { lesson_id, regenerate_only: "reading" }
  - No manipula brief status manualmente
```

### ReadingMaterialView - validacion + PDF

```text
- Si status === "INVALIDATED" y validation_reasons.length > 0:
  Mostrar Alert destructive con lista de razones

- Boton "Descargar como PDF":
  Abre nueva ventana con el HTML del material + CSS de impresion
  El docente usa Ctrl+P / Cmd+P para guardar como PDF
```
