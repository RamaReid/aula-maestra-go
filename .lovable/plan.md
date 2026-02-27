

# Carga de Diseños Curriculares Oficiales de PBA

## Resumen

Se van a cargar los 5 documentos curriculares oficiales de la Provincia de Buenos Aires como `curriculum_documents` y sus contenidos como `curriculum_nodes`, usando la estructura existente en la base de datos. Esto permitira que el selector de bibliografia (Modo C) funcione con datos reales cuando los docentes creen cursos de Historia, Matematica o Filosofia.

## Documentos a cargar

| # | Materia | Anio | Ciclo | Archivo |
|---|---------|------|-------|---------|
| 1 | Historia | 5 | UPPER | Historia_1.pdf |
| 2 | Matematica | 5 | UPPER | Matematica_1.pdf |
| 3 | Matematica | 6 | UPPER | Matematica_ciclo_superior.pdf |
| 4 | Filosofia | 6 | UPPER | Filosofia.pdf |
| 5 | Filosofia e Historia de la Ciencia y la Tecnologia | 6 | UPPER | Filosofia_e_Historia_de_la_Ciencia_y_la_Tecnologia.pdf |

## Estructura de nodos por documento

Se usara la jerarquia: DOCUMENTO -> EJE/UNIDAD -> CONTENIDO

### 1. Historia 5to anio (5 unidades, ~15 contenidos)

- **Unidad 1**: Ejes para una mirada general. La Guerra Fria, las nuevas formas de dependencia y las luchas anticoloniales
- **Unidad 2**: El mundo de posguerra. America Latina frente a las crisis de los populismos (hasta mediados de los anios 60)
- **Unidad 3**: Las crisis del petroleo en los 70: el final del Estado de bienestar, la radicalizacion politica y los estados burocraticos autoritarios
- **Unidad 4**: Neoliberalismo, dictaduras militares y el retorno democratico
- **Unidad 5**: Los legados de una epoca

Cada unidad tendra contenidos especificos como nodos hijos de tipo CONTENIDO.

### 2. Matematica 5to anio (4 ejes, ~12 contenidos)

- **Eje Geometria y Algebra**: Semejanza, Razon entre areas y volumenes, Lugar Geometrico, Hiperbola, Elipse
- **Eje Numeros y Operaciones**: Numeros reales, Intervalos en R, Logaritmo, Sucesiones
- **Eje Algebra y Funciones**: Ecuaciones e inecuaciones, Funciones cuadraticas, Polinomios, Funciones exponencial y logaritmica, Funciones homograficas
- **Eje Probabilidad y Estadistica**: Muestra y poblacion, Parametros de posicion y dispersion

### 3. Matematica 6to anio (4 ejes, ~12 contenidos)

- **Eje Geometria y Algebra**: Ecuacion vectorial de la recta, Nocion de fractal
- **Eje Numeros y Operaciones**: Numeros complejos, Series
- **Eje Algebra y Funciones**: Funciones trigonometricas, Concepto de limite, Derivada, Estudio completo de funciones, Integrales
- **Eje Probabilidad y Estadistica**: Distribucion Normal, Distribucion Binomial

### 4. Filosofia 6to anio (6 modulos, ~18 contenidos)

- **Modulo 1**: La filosofia como pensamiento problematizador (filosofia vs ciencia vs ideologia, filosofar vs historia de la filosofia, pensamiento critico)
- **Modulo 2**: Del conocimiento como copia al conocimiento como accion (gnoseologia clasica, Descartes a Kant, Nietzsche, Dewey, Frankfurt)
- **Modulo 3**: Arte y estetica (Kant y autonomia del arte, mimesis, vanguardias, Duchamp, Warhol, Eco, Danto)
- **Modulo 4**: Etica (Aristoteles, Kant, utilitarismo, derechos humanos)
- **Modulo 5**: Filosofia politica (polis griega, contrato social, democracia contemporanea)
- **Modulo 6**: Filosofia de la historia (sujeto historico, progreso, memoria)

### 5. Filosofia e Historia de la Ciencia y la Tecnologia 6to anio (7 unidades, ~21 contenidos)

- **Unidad 1**: Las teorias cientificas (observacion, hipotesis, contrastacion, revolucion copernicana)
- **Unidad 2**: Controversias cientificas (instrumentos, precision, progreso)
- **Unidad 3**: Teorias y metodos (fuentes historiograficas, cambio en la historia)
- **Unidad 4**: Sucesion de teorias (continuidad, corroboracion, causalidad)
- **Unidad 5**: Articulacion entre teorias (ciencia teorica vs experimental, serendipia)
- **Unidad 6**: Ciencias formales y ciencias facticas (axiomas, completitud, geometrias no euclideanas)
- **Unidad 7**: Ciencias Sociales (naturalismo, positivismo, aspectos eticos)

## Implementacion tecnica

Una sola migracion SQL que:

1. Inserta 5 registros en `curriculum_documents` (province='PBA', status='VERIFIED', cycle='UPPER')
2. Inserta los ejes/unidades/modulos como nodos de tipo EJE o UNIDAD
3. Inserta los contenidos especificos como nodos de tipo CONTENIDO, con `parent_id` apuntando al eje/unidad correspondiente
4. Todos con `order_index` secuencial para mantener el orden curricular

Total estimado: ~5 documentos, ~25 ejes/unidades, ~80 contenidos = ~110 registros en `curriculum_nodes`.

## Tambien se necesitan datos de prueba para el flujo completo

Ademas de los documentos curriculares, se insertara un conjunto minimo de datos de prueba asociados al usuario actual para poder recorrer el flujo end-to-end del PRD 2:

- 1 `school` (EES N.1 de ejemplo)
- 1 `course` (Historia 5to, status ACTIVE)
- 1 `plan` (status VALIDATED, vinculado al course de Historia 5to)
- 3 `plan_content_mappings` (vinculando nodos de Historia 5to al plan)
- 2 `plan_lessons` (con theme, justification y learning_outcome completos)
- 2 `lessons` (status PLANNED)

Esto permitira navegar Dashboard -> Course -> Lesson -> Relevamiento -> Generacion.

## Archivos a modificar

Ninguno. Solo se ejecuta una migracion SQL de seed.

