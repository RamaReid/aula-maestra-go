

# Plan: Mostrar Unidad curricular real en cada clase

## Hallazgo clave de los datos

Cada clase ya esta vinculada via `plan_lesson_content_links` a nodos de tipo `UNIDAD` y `CONTENIDO`. Por ejemplo:
- Clase 1 → **Unidad 1: Las teorias cientificas** + contenido "Observacion, hipotesis y contrastacion empirica" → tema: "La ciencia en el imaginario popular"
- Clase 7 → **Unidad 4: Sucesion de teorias** + contenido "Instrumentos cientificos..." → tema: "Introduccion a las Controversias Cientificas"

La relacion es: cada clase pertenece a una **Unidad** (bloque/modulo curricular) y tiene un **Tema** propio. El campo `justification` es otra cosa (justificacion pedagogica de la clase), no tiene nada que ver con la unidad.

## Cambios en `PlanLessonsEditor.tsx`

### 1. Fetch de unidades vinculadas
Al cargar las lecciones, hacer un query adicional:
```
plan_lesson_content_links (plan_lesson_id IN lesson_ids)
  → plan_content_mappings (id)
    → curriculum_nodes (filtrar node_type = 'UNIDAD')
```
Construir un `Map<lessonId, string>` con el nombre de la unidad para cada clase.

### 2. Trigger del Accordion — mostrar Unidad + Tema
Cambiar el trigger de cada clase para mostrar:
- **Clase N** | Badge cuatrimestre | **Unidad: Las teorias cientificas** | Tema: La ciencia en el imaginario popular

### 3. Renombrar labels
- "Foco de la clase" → **"Tema de la clase"**
- "Justificacion" queda como campo interno pero NO se muestra en el trigger (no es la unidad)
- El placeholder de justificacion se ajusta a: "Fundamentacion pedagogica de esta clase en la progresion anual"

### 4. Dentro del AccordionContent — estructura visible
Orden de campos:
1. **Unidad** (solo lectura, mostrado como texto muted, viene del curriculum)
2. **Tema de la clase** (editable, campo `theme`)
3. **Justificacion pedagogica** (editable, campo `justification`)
4. **Resultado de aprendizaje** (editable, campo `learning_outcome`)
5. **Operacion y evidencia minima** (editable, campo `activities_summary`)

### 5. Agrupar por cuatrimestre
Separar las clases en dos bloques: "Primer cuatrimestre" y "Segundo cuatrimestre" segun `term`.

## Cambios en `PlanEditor.tsx` (PDF export)
En el imprimible, cada clase muestra solo: `Clase X — Unidad: Y — Tema: Z` (sin justificacion, sin evidencia).

## No requiere migracion de base de datos
Todos los datos ya existen en `plan_lesson_content_links` + `curriculum_nodes`.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/plan/PlanLessonsEditor.tsx` | Fetch unidades via content links, agrupar por cuatrimestre, renombrar labels, mostrar unidad en trigger |
| `src/components/plan/PlanEditor.tsx` | Ajustar PDF export para incluir unidad real por clase |

