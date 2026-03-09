

## Plan: Layout armónico para Canon de esta clase

El problema actual es que los 3 campos (Tema, Operación, Evidencia mínima) están en `grid-cols-3` iguales, pero Tema es siempre corto (1-2 oraciones) mientras que Operación es mucho más largo. Esto genera espacio desperdiciado y desbalance visual.

### Cambio

**`src/pages/Lesson.tsx` (líneas 572-585)** — Reemplazar el grid de 3 columnas iguales por un layout de 2 filas:

- **Fila 1:** Título "Canon de esta clase" + Tema al lado (inline), ya que Tema es corto y funciona como subtítulo contextual.
- **Fila 2:** Grid de 2 columnas para Operación (col-span mayor o ~60%) y Evidencia mínima (~40%).

Estructura resultante:

```text
┌─────────────────────────────────────────────────┐
│ Canon de esta clase          Tema: [texto corto]│
├────────────────────────────┬────────────────────┤
│ Operación                  │ Evidencia mínima   │
│ [texto largo, el que más   │ [texto mediano]    │
│  espacio necesita]         │                    │
└────────────────────────────┴────────────────────┘
```

Concretamente:
- El `CardHeader` pasa a ser `flex items-start justify-between` con el título a la izquierda y el Tema a la derecha (texto corto, `text-sm text-muted-foreground`, max-w para que no se estire).
- El `CardContent` cambia de `grid md:grid-cols-3` a `grid md:grid-cols-[3fr_2fr]` con solo Operación y Evidencia mínima.

