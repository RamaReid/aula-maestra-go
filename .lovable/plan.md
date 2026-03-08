

# Plan: Corregir contenidos (son de índice, no reales), agregar rúbrica en Evaluación, y renombrar "Expandir"

## Problemas identificados

### 1. Los contenidos mostrados son el ÍNDICE del PDF, no los contenidos reales
Los `curriculum_nodes` almacenados contienen entradas del índice del PDF como:
- `"Módulo 1 ..................................................................................................................... 16"`
- `"Módulo 2 ..................................................................................................................... 16"`

Pero los contenidos reales del documento son:
- **MÓDULO 1**: "¿En qué sentido la filosofía puede ser considerada un pensamiento problematizador?" con temas como "La filosofía en el territorio de la ciencia...", "¿Filosofía o filosofar?...", etc.
- **MÓDULO 2**: "Del conocimiento como copia al conocimiento como acción..." con sus propios temas.

El problema es que el script de extracción (`import-curriculum-pdfs.mjs`) parsea las líneas del índice como si fueran encabezados de unidad/contenido. Los verdaderos contenidos están más adelante en el `raw_text` y nunca se extrajeron como nodos.

### 2. La pestaña Evaluación no tiene rúbrica
Debe incluir criterios de evaluación por módulo, no solo un textarea libre. El PDF original tiene una sección "Criterios de evaluación" por módulo (páginas 25-27) que ya está en `raw_text`.

### 3. Los botones dicen "Expandir" en vez de "Expandir editar"

## Cambios

### A. Corregir extracción de nodos curriculares (script + reimportación)

**`scripts/import-curriculum-pdfs.mjs`** - Mejorar `extractCurriculumNodes`:
- Detectar y **saltar la sección del ÍNDICE** (desde la línea "ÍNDICE" hasta la siguiente sección real como "PRESENTACIÓN").
- Reconocer las líneas con puntos suspendidos y números de página (`........ 16`) como entradas de índice y descartarlas.
- Parsear los `MÓDULO N` reales que vienen con pregunta-problema y bullet points de contenido.

Después de corregir el script, re-ejecutar la importación para reemplazar los nodos incorrectos con los verdaderos contenidos por módulo.

### B. Evaluación: agregar rúbrica basada en módulos de contenido

**`src/components/plan/PlanEditor.tsx`** - Pestaña Evaluación:
- Mantener el textarea actual de `evaluacion_marco` para criterios generales.
- Debajo, mostrar una sección "Rúbrica por módulo/unidad" que liste los módulos de contenido (obtenidos de `groupedContent` o del fallback curricular) con un campo de texto editable por cada uno para que el docente defina criterios de evaluación específicos.
- Esto requiere una nueva tabla o columna para almacenar la rúbrica por unidad.

**Migración de base de datos**: Crear tabla `plan_rubric_items`:
```sql
CREATE TABLE plan_rubric_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  unit_label text NOT NULL DEFAULT '',
  criteria text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE plan_rubric_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage rubric items" ON plan_rubric_items FOR ALL
  USING (is_plan_owner(auth.uid(), plan_id));
```

En la pestaña Evaluación:
1. Sección superior: textarea de criterios generales (ya existe).
2. Sección inferior: lista de módulos/unidades con un campo de criterios por cada uno, editable, con autoguardado.

### C. Renombrar "Expandir" a "Expandir editar"

**`src/components/plan/PlanEditor.tsx`** - 5 ocurrencias del botón "Expandir" (líneas 735, 773, 883, 917, 965) cambian a "Expandir editar".

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `scripts/import-curriculum-pdfs.mjs` | Filtrar índice del PDF, parsear módulos reales con sus contenidos |
| `src/components/plan/PlanEditor.tsx` | Renombrar botones, agregar rúbrica por módulo en Evaluación |
| Nueva migración SQL | Crear tabla `plan_rubric_items` |

## Orden de ejecución

1. Migración DB para `plan_rubric_items`
2. Corregir script de importación para que no tome el índice como contenido
3. Actualizar PlanEditor: botones "Expandir editar" + sección rúbrica en Evaluación
4. Re-importar los nodos curriculares con los contenidos reales (requiere ejecutar el script manualmente)

