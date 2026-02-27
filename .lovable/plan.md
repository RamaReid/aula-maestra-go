
# Limpiar artefactos de markdown del material de lectura

## Problema

El modelo de IA a veces envuelve su respuesta en bloques de codigo markdown (` ```html ... ``` `), lo que deja backticks visibles en el texto renderizado.

## Solucion

Limpiar la respuesta en **dos puntos**:

### 1. Edge function (servidor) -- antes de guardar en la base de datos

En `supabase/functions/generate-materials/index.ts`, agregar una funcion `cleanMarkdownArtifacts` que:
- Remueva bloques de codigo markdown (` ```html `, ` ``` `)
- Haga trim del resultado

Aplicarla en la linea donde se asigna `readingHtml` (linea ~432):

```typescript
function cleanMarkdownArtifacts(text: string): string {
  return text
    .replace(/```(?:html|HTML)?\s*/gi, "")
    .trim();
}

// Uso:
readingHtml = cleanMarkdownArtifacts(readingResult.choices[0].message.content || "");
```

### 2. Componente de vista (cliente) -- para datos ya guardados

En `src/components/lesson/ReadingMaterialView.tsx`, aplicar la misma limpieza al `content_html` antes de renderizar, para que los materiales ya generados tambien se vean correctos sin necesidad de regenerarlos.

## Archivos a modificar

- `supabase/functions/generate-materials/index.ts` -- agregar funcion de limpieza y aplicarla al resultado del LLM
- `src/components/lesson/ReadingMaterialView.tsx` -- limpiar HTML antes de renderizar
