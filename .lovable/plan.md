

# Problema: el parser NO maneja correctamente el ejemplo real

Analicé el parser contra el texto exacto que proporcionaste. El problema concreto:

En el PDF extraído, las líneas de continuación **también empiezan con `•`** porque el PDF las corta así. Ejemplo del Módulo 1:

```
• La filosofía en el territorio de la ciencia, de la ideología y del sentido común. La relación
• de la filosofía con el conjunto de los saberes.
```

El parser actual (línea 81-88) trata **cada `•`** como un bullet nuevo. Resultado: genera ~12 children para el Módulo 1 en lugar de los 6 reales. Las líneas como `"de la filosofía con el conjunto de los saberes."` y `"crítico. Sentidos de la crítica..."` quedan como items separados cuando deberían ser continuaciones del bullet anterior.

**Heurística faltante:** si una línea empieza con `•` pero el texto después del bullet **comienza con minúscula**, es una continuación del bullet anterior, no un bullet nuevo.

## Ejemplo esperado para Módulo 1 (6 items, no 12)

1. "¿En qué sentido la filosofía puede ser considerada un pensamiento problematizador?"
2. "La filosofía en el territorio de la ciencia, de la ideología y del sentido común. La relación de la filosofía con el conjunto de los saberes."
3. "¿Filosofía o filosofar? La filosofía y los filósofos. La historia de la filosofía."
4. "¿Qué es un problema filosófico? Clasificación de preguntas y configuración de las disciplinas filosóficas."
5. "¿En qué piensan los filósofos? Pensar por uno mismo y la relación con lo otro."
6. "¿Qué es el pensamiento crítico? La imagen dogmática del pensamiento vs. el pensamiento crítico. Sentidos de la crítica. La importancia de la argumentación y el pensamiento crítico"

## Cambio

### `supabase/functions/repair-curriculum-nodes/index.ts`

En el bloque de detección de bullets (líneas 80-88), agregar:

```typescript
const bulletMatch = line.match(/^[•\-–—]\s*(.+)/);
if (bulletMatch) {
  const content = bulletMatch[1].trim();
  if (content.length > 5 && !isTocLine(content)) {
    // Si empieza con minúscula → es continuación del bullet anterior
    const startsLowercase = /^[a-záéíóúñ]/.test(content);
    if (startsLowercase && lastChildWasBullet && currentModule.children.length > 0) {
      const lastIdx = currentModule.children.length - 1;
      currentModule.children[lastIdx] += " " + content;
    } else {
      currentModule.children.push(content);
      lastChildWasBullet = true;
    }
  }
  continue;
}
```

Misma lógica para la continuación sin bullet (línea 102-106) que ya funciona correctamente.

### `scripts/import-curriculum-pdfs.mjs`

Aplicar la misma heurística de minúscula-es-continuación en `extractCurriculumNodes` si existe lógica de bullets ahí.

| Archivo | Cambio |
|---|---|
| `supabase/functions/repair-curriculum-nodes/index.ts` | Bullet con minúscula = continuación |
| `scripts/import-curriculum-pdfs.mjs` | Misma heurística si aplica |

