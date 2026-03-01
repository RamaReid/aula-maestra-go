

# Actualizar Demo.tsx con contenido canonico del plan

## Contexto

El Demo.tsx actualmente muestra datos inventados ("Historia 4to ano", fundamentacion de 2 lineas, 6 lecciones ficticias). El documento canon que proporcionaste ES la planificacion completa y debe ser el contenido que se vea en la pestaña Planificacion del demo. Ademas, la estructura de tabs debe alinearse con el PlanEditor real (6 tabs).

El contenido textual exacto ya esta disponible en `supabase/functions/seed-demo-course/index.ts` (lineas 62-167), que fue aprobado previamente.

## Cambios en `src/pages/Demo.tsx`

### 1. Header

- "Historia . 4. ano" se reemplaza por "Filosofia e Historia de la Ciencia y la Tecnologia . 6. ano"
- "E.E.S. N. 5 . 2026" se reemplaza por "EESA . 2026"

### 2. DEMO_PLAN (datos mock)

Se reemplaza el objeto con el contenido real del canon:
- `fundamentacion`: texto completo (~1800 chars) sobre el espacio curricular, practica de pensamiento, ejes problematizadores
- `estrategias_marco`: texto sobre exposicion dialogada, lectura guiada, trabajo con situaciones del taller, tecnicas grupales
- `estrategias_practicas`: array de 5 items reales
- `evaluacion_marco`: texto completo incluyendo instrumentos y rubrica C1-C5 con ponderacion
- `resources`: texto completo sobre infraestructura, materiales didacticos, recursos para casos, aportes de docentes/alumnado

### 3. DEMO_OBJECTIVES (nuevo array)

8 objetivos de aprendizaje del canon (los mismos del seed).

### 4. DEMO_LESSONS (28 clases en vez de 6)

Las 28 clases del cronograma canon con:
- `num`, `theme`, `activities_summary`, `term`
- Estados mock variados (`brief` y `material`) para mostrar distintos badges en la UI

### 5. DEMO_MATERIAL_HTML

Se reemplaza "Revolucion Industrial" con un material representativo de la Clase 1 del canon: "Concepto de Filosofia: que es, para que y como se practica".

### 6. Tabs: de 4 a 6

Se alinea con PlanEditor real:

```text
Fundamentacion | Estrategias | Evaluacion | Objetivos (4-8) | Recursos | Cronograma
```

- `grid-cols-4` cambia a `grid-cols-3 md:grid-cols-6`
- Tab "Planificacion" anterior se descompone en los 6 sub-tabs del plan (igual que PlanEditor)
- Se elimina el tab contenedor "Planificacion" y se ponen los 6 tabs como tabs principales
- Tabs "Materiales" y "Agenda" se mantienen pero se integran como tabs 7 y 8 (o se dejan en un segundo nivel)

**Alternativa mas simple** (recomendada): mantener la estructura de 2 niveles actual:
- Nivel 1: Planificacion | Materiales | Agenda (3 tabs)
- Dentro de "Planificacion": los 6 sub-tabs del PlanEditor (Fundamentacion, Estrategias, Evaluacion, Objetivos, Recursos, Cronograma) como cards apiladas o tabs anidados

**Decision**: Usar la misma estructura que el PlanEditor real: 6 tabs principales para la planificacion + tabs "Materiales" y "Agenda" como secciones separadas debajo o en un nav superior. Esto refleja fielmente como se ve un plan real.

Layout final:
- Tabs principales: Fundamentacion | Estrategias | Evaluacion | Objetivos (4-8) | Recursos | Cronograma | Materiales | Agenda
- Total: 8 tabs, `grid-cols-4 md:grid-cols-8`

### 7. Contenido de cada tab

- **Fundamentacion**: Textarea readonly con el texto completo + contador de caracteres
- **Estrategias**: Marco (textarea readonly) + Practicas (badges con los 5 items)
- **Evaluacion**: Textarea readonly con texto completo incluyendo rubrica
- **Objetivos (4-8)**: Lista numerada readonly de los 8 objetivos
- **Recursos**: Textarea readonly con texto completo
- **Cronograma**: Tabla con las 28 clases agrupadas por cuatrimestre (#, Tema, Actividades, Term)
- **Materiales**: Mantenido como esta (material de ejemplo de Clase 1, adaptado al canon)
- **Agenda**: Tabla con las 28 clases + columna Actividades (alineado con AgendaView)

## Archivo afectado

| Archivo | Accion |
|---------|--------|
| `src/pages/Demo.tsx` | Reescribir datos mock + expandir a 8 tabs con contenido canon |

No se toca ningun otro archivo.
