

# Plan completo: Todas las correcciones pendientes del PlanEditor

Tenés razón, me quedé solo con la sangría y dejé de lado todo lo demás. Acá va el plan completo con los 7 cambios que acordamos.

## Cambios a implementar

### 1. Fundamentación — sangría en primer línea de CADA párrafo
- Reemplazar el `<Textarea className="indent-8">` por un sistema vista/edición
- **Vista (default):** texto spliteado por `\n\n`, cada `<p>` con `text-indent: 2rem` via CSS class `.fundamentacion-preview p`
- **Edición:** click o doble-click muestra textarea normal; `onBlur` vuelve a vista formateada
- Mismo approach en el modal expandido

### 2. Recursos — 4 sub-bloques según canon
Reemplazar el textarea único por 4 campos separados:
1. **Infraestructura disponible**
2. **Materiales y soportes**
3. **Casos y situaciones**
4. **Aportes y alternativas low-tech**

Se guardan en `plan.resources` como texto con separadores internos (`===INFRAESTRUCTURA===\n...===MATERIALES===\n...`). Al cargar se parsean, al guardar se unifican. Cada sub-bloque tiene su textarea con placeholder orientador.

### 3. Evaluación / Rúbrica — alineada 1:1 con módulos reales
- `initRubricFromContent` debe generar exactamente un item por cada grupo UNIDAD (no duplicar)
- Si ya hay rubricItems cuya cantidad coincide con los módulos, deshabilitar el botón con tooltip "La rúbrica ya está alineada"
- Placeholders por módulo: "Criterios para evaluar comprensión del Módulo N: [tema del módulo]"

### 4. Clases — vista compacta en planificación
Reescribir `PlanLessonsEditor.tsx`:
- Eliminar el Accordion con campos editables completos
- Mostrar tabla compacta: `Clase N | T1/T2 | Unidad | Tema | Estado`
- Solo `theme` editable inline (click para editar)
- Los campos justificación, resultado, operación+evidencia se editan cuando el usuario entra a la clase individual post-validación
- Mantener `fetchLessonUnitMap` export sin cambios

### 5. "Rearmar borrador" — solo si hay cambio
- Agregar estado `needsRebuild` que es `true` si: (a) plan está INCOMPLETE, o (b) no hay contenidos mapeados, o (c) el plan no tiene fundamentación
- Si el plan ya tiene contenido y está VALIDATED/EDITED, deshabilitar el botón con tooltip "El borrador ya está construido"

### 6. Repair-curriculum-nodes — merge de líneas de continuación
Actualizar `parseModulesFromRawText` en la edge function:
- Líneas que empiezan con `•` crean un nuevo child
- Líneas SIN bullet que siguen a un bullet se concatenan al último child (son continuaciones de párrafo)
- Esto resuelve que contenidos como "de la filosofía con el conjunto de los saberes." se unan al bullet anterior

### 7. CSS
Agregar en `index.css`:
```css
.fundamentacion-preview p {
  text-indent: 2rem;
  margin-bottom: 0.75rem;
  line-height: 1.8;
}
```

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/plan/PlanEditor.tsx` | Fundamentación vista/edición, Recursos 4 sub-bloques, Rúbrica sin duplicados + placeholders, Rearmar condicionado |
| `src/components/plan/PlanLessonsEditor.tsx` | Vista compacta tabla sin accordion |
| `src/index.css` | Clase `.fundamentacion-preview p` |
| `supabase/functions/repair-curriculum-nodes/index.ts` | Merge de líneas de continuación en parseModulesFromRawText |

## Orden de ejecución
1. Edge function (repair-curriculum-nodes) — fix parsing
2. PlanLessonsEditor — vista compacta
3. PlanEditor — fundamentación, recursos, rúbrica, rearmar
4. CSS

