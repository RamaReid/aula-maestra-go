

## Plan: Hacer visible el botón "Editar indicaciones" en la parte superior del brief

### Problema

El botón "Editar indicaciones" existe pero está al final del formulario (línea 945). El usuario ve los campos deshabilitados y no sabe que tiene que scrollear hasta abajo para encontrar el botón. Necesita estar visible junto al StepHeader de "Paso 1 — Indicaciones", donde dice "Producido".

### Solución

**Archivo: `src/components/lesson/BriefForm.tsx`**

1. **Mover el botón "Editar indicaciones" arriba**, justo después del StepHeader (donde dice "Producido"), dentro de un banner visible con fondo suave que diga: "Las indicaciones están confirmadas" + botón "Editar indicaciones" en la misma línea.

2. **Eliminar el bloque duplicado del fondo** (líneas 945-968) que ya no será necesario.

3. El banner se muestra solo cuando `isConfirmed && !manualReopen && !hasInvalidSelections`, igual que ahora pero en posición prominente.

### Cambio concreto

Después del `<StepHeader>` del Paso 1 (que ya muestra "Producido"), agregar:

```tsx
{isConfirmed && !manualReopen && !hasInvalidSelections && (
  <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
    <p className="text-sm text-muted-foreground">
      Las indicaciones están confirmadas. Podés reabrir para modificar y regenerar.
    </p>
    <Button variant="outline" size="sm" onClick={handleReopenBrief} disabled={saving}>
      Editar indicaciones
    </Button>
  </div>
)}
```

Extraer la lógica del `onClick` actual a una función `handleReopenBrief` para no duplicar código.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/lesson/BriefForm.tsx` | Mover botón "Editar indicaciones" arriba junto al StepHeader, eliminar el bloque del fondo |

