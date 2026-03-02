

# Plan: Reescritura de Demo.tsx con contenido canonico (4 pestanas)

## Objetivo

Reescribir completamente `src/pages/Demo.tsx` con 4 pestanas que renderizan texto literal de los 3 documentos canon adjuntos. Sin backend, sin componentes nuevos, sin tocar otros archivos.

## Archivo unico modificado

`src/pages/Demo.tsx` -- reescritura completa (~2000+ lineas por el contenido literal embebido).

---

## Estructura

### Estado React

```text
activeTab: string (controlado, default "planificacion")
undevelopedNotice: number | null (para mostrar aviso en tab "clase")
```

Tabs controlado: `<Tabs value={activeTab} onValueChange={...}>` para permitir navegacion programatica desde la Agenda.

### Header

Cambia de "Historia 4to ano" a los datos del canon:
- "Filosofia e Historia de la Ciencia y la Tecnologia -- 6.o ano EESA"
- "Provincia de Buenos Aires -- 2 modulos semanales"

### 4 Pestanas

TabsList con `grid-cols-2 md:grid-cols-4`.

---

## Tab A: Planificacion

Renderiza el documento `canon_demo_planificacion_anual` completo como cards verticales, siguiendo cada encabezado del markdown en orden:

1. **Fundamentacion** -- 4 parrafos largos como `<p>` dentro de Card
2. **Objetivos generales** -- 11 items como `<ul><li>`
3. **Objetivos de aprendizaje** -- 8 items como `<ul><li>`
4. **Contenidos** -- Subsecciones Primer cuatrimestre (Unidad I, II) y Segundo cuatrimestre (Unidad III, IV, V). Cada unidad como `<h4>` + `<ul><li>`
5. **Organizacion espacio-temporal** -- Cuatrimestre 1 (14 clases) y Cuatrimestre 2 (14 clases) como lista numerada con parrafos. Cada clase: numero + tema + actividades en texto. NO tabla.
6. **Estrategias didacticas** -- 5 items como `<ul><li>`
7. **Recursos** -- 4 subsecciones (Infraestructura, Materiales, Casos, Aportes) cada una con `<h4>` + `<ul><li>`
8. **Adaptaciones situadas** -- 3 items
9. **Formas de evaluar** -- Texto introductorio + Instrumentos + Rubrica C1-C5. La rubrica se renderiza como cards anidadas o listas de definicion (cada criterio: nombre bold, descripcion italica, 4 niveles como sub-lista `<ul><li>`). NO tabla.
10. **Ponderacion** -- Texto corto
11. **Bibliografia** -- General (16 entradas) + Por caso de estudio (7 subsecciones con sus entradas) + Para temas de integracion (5 subsecciones). Cada entrada como `<li>`.
12. **Carpeta de casos** -- A-F como lista
13. **Ejemplo desarrollado -- Caso A Dulce** -- Secciones como sub-cards con parrafos

Todo el contenido es texto literal del markdown, sin resumir ni reescribir.

---

## Tab B: Secuencia

Renderiza `secuencia_didactica_unidad_iii_clases_15_17` completo:

1. **Header** -- Espacio, carga, tramo, eje (como Card introductoria)
2. **Propositos** -- 5 items
3. **Alcances y encuadre** -- 2 parrafos
4. **Aprendizajes esperados** -- 4 items
5. **Evidencia minima** -- Producto integrador (3 sub-items numerados) + Recuperacion equivalente
6. **Evaluacion formativa** -- Lista de cotejo: 5 items como `<ol><li>`. NO tabla.
7. **Clase 15** (con `id="clase-15"`) -- Card con: Proposito, Entrada, Desarrollo (3 sub-actividades), Cierre, Plan B
8. **Clase 16** (con `id="clase-16"`) -- Card con: Proposito, Entrada, Desarrollo (3 sub-actividades + 4 falacias), Cierre, Plan B
9. **Clase 17** (con `id="clase-17"`) -- Card con: Proposito, Entrada, Desarrollo (4 sub-actividades), Cierre, Plan B
10. **Plantilla de produccion** -- Secciones A, B, C como sub-cards
11. **Material de lectura para estudiantes** -- Texto corrido completo (~24 parrafos sobre ambiguedad, vaguedad, falacias, cohesion, referencias). Incluye las 4 falacias como sub-secciones.

Cada clase tiene un `id` HTML para scroll-anchor desde la Agenda.

---

## Tab C: Preparar clase

Renderiza `clase_20_popper` completo:

1. **Header** -- Curso, ubicacion en secuencia
2. **Proposito** -- 1 parrafo
3. **Contenidos de la clase** -- 2 items
4. **Bibliografia de base** -- 1 entrada
5. **Material de lectura para estudiantes** -- Texto corrido completo (titulo "Popper: por que una buena teoria tiene que poder fallar" + ~7 parrafos largos)
6. **Desarrollo de la clase** -- 4 momentos como sub-cards:
   - Entrada (10-15'): retoma y puente con Kuhn
   - Lectura guiada (20-25'): preguntas de control
   - Actividad central (35-40'): consigna + 3 situaciones + plantilla de produccion (5 items)
   - Cierre (10-15'): socializacion y salida
7. **Evidencia minima** -- Producto + 5 criterios como lista
8. **Recuperacion equivalente** -- 2 items
9. **Recursos** -- 3 items
10. **Plan B** -- 1 parrafo
11. **Adaptaciones situadas** -- 3 items

Si se llega desde una clase no desarrollada (via Agenda), se muestra un Card con fondo warning encima: "Clase {N} no esta desarrollada en este demo. Solo se incluyen las clases 15, 16, 17 y 20."

---

## Tab D: Agenda

Layout con `div` + grid/flex (NO `<table>`):
- Header row: N | Tema | Estado | Accion (con font-medium text-muted-foreground)
- 28 filas, una por clase del cronograma canon
- Cada fila es un `div` con `grid grid-cols-[2rem_1fr_auto_auto]` y `border-b`

Datos: los 28 temas se toman literalmente del cronograma del canon (lineas 106-136).

**Estado:**
- Clases 15, 16, 17, 20: `StatusBadge tone="success" label="Desarrollada"`
- Resto: `StatusBadge tone="neutral" label="No desarrollada"`

**Boton "Ver clase":**
- Clic en 15, 16 o 17: `setActiveTab("secuencia")` + `setTimeout(() => document.getElementById("clase-N")?.scrollIntoView({ behavior: "smooth" }), 150)`
- Clic en 20: `setActiveTab("clase")` + `setUndevelopedNotice(null)`
- Clic en otra: `setActiveTab("clase")` + `setUndevelopedNotice(N)`

---

## Formato (regla estricta)

- Tabs Planificacion, Secuencia y Preparar clase: PROHIBIDO `<table>`. Solo cards, headings, parrafos y listas.
- Tab Agenda: layout con div/grid/flex simulando filas. PROHIBIDO `<table>`.
- La rubrica C1-C5 se renderiza como cards con listas internas.
- El cronograma 1-28 se renderiza como lista numerada con parrafos.

---

## Datos embebidos

Todo el texto de los 3 markdowns se almacena como constantes TypeScript al inicio del archivo. Esto incluye:
- ~450 lineas del canon de planificacion
- ~228 lineas de la secuencia
- ~128 lineas de clase 20
- Array de 28 objetos para el cronograma/agenda

El archivo sera largo (~2500 lineas) pero autocontenido, cumpliendo el constraint de "solo Demo.tsx".

---

## Imports (todos ya disponibles)

- `useState` de React
- `Link` de react-router-dom
- `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`
- `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
- `Badge`
- `StatusBadge` de `@/components/ui/StatusBadge`
- `toast` de `@/hooks/use-toast`
- `AlertTriangle`, `Eye`, `BookOpen` de `lucide-react`
- `ScrollArea` de `@/components/ui/scroll-area`

---

## Lo que NO se hace

- No se crean archivos nuevos
- No se modifican otros archivos
- No se hacen llamadas a backend/DB/RPC
- No se inventa ni resume contenido
- No se usa `<table>` en ningun lugar

