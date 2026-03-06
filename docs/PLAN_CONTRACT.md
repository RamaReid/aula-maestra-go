# Contrato Funcional por Plan

Fecha de referencia: 2026-03-06

## Objetivo

Este documento fija el contrato funcional esperado de la aplicacion por plan para evitar ambiguedades entre UI, entitlements, edge functions y entregables.

## Flujo comun a todos los planes

1. El usuario crea o selecciona un curso.
2. El curso se vincula a un documento curricular oficial o importado.
3. Se genera un borrador de plan anual.
4. El plan debe quedar validado para habilitar la generacion de materiales.
5. Cada clase requiere brief listo para produccion.
6. La generacion produce:
   - `teaching_materials`
   - `reading_materials`
7. El material de lectura se valida y puede terminar con:
   - PDF persistido
   - PDF temporal
   - material invalidado

## FREE

### Limites

- Maximo 1 curso activo.
- Maximo 35 estudiantes por curso.
- Maximo 2 sesiones semanales.
- Exactamente 3 clases por sesion de preparacion.

### UX esperada

- El dashboard debe priorizar un unico curso de muestra.
- La planificacion no debe exponerse como editor principal.
- El curso debe preparar la anual en segundo plano si hace falta para mostrar secuencia y clases.
- El usuario debe elegir exactamente 3 clases del mismo curso.
- Esas 3 clases pueden ser:
  - tres clases puntuales
  - una secuencia de 3 clases consecutivas

### Entregables esperados

- Material didactico generado por clase.
- Material de lectura generado por clase.
- PDF de lectura temporal.
- Watermark aplicado al PDF.

### Restricciones visibles

- Sin exportacion PDF validada desde UI.
- Sin almacenamiento persistente de PDF.
- Sin Copiloto.
- Sin historial.

## BASICO

### Limites

- Hasta 15 cursos activos.
- Sesiones semanales sin limite practico de negocio.
- Clases por sesion sin limite practico de negocio.
- La planificacion anual del curso queda persistida y no debe regenerarse en el uso normal.
- El curso trabaja sobre 28 clases base anuales y puede admitir clases alternativas adicionales dentro del margen de negocio que se defina.

### UX esperada

- Acceso al editor completo del curso:
  - planificacion
  - agenda
  - lecciones
- Seleccion de una clase o una secuencia.
- La secuencia debe ser consecutiva.
- El maximo seleccionable debe coincidir con la cantidad de clases existentes en el curso.
- Puede incorporar fuentes propias del docente por archivo para una clase o secuencia puntual.
- Formatos iniciales permitidos:
  - `PDF`
  - `JPG`
  - `JPEG`
  - `PNG`

### Entregables esperados

- Material didactico validado.
- Material de lectura validado.
- PDF de lectura persistido en storage.
- Exportacion PDF para material didactico validado.
- Exportacion PDF para material de lectura validado.

### Restricciones visibles

- Sin watermark.
- Copiloto en modo `limited`.
- Historial habilitado.
- Sin busqueda libre en internet para nuevas fuentes.

## PREMIUM

### Limites

- Sin limite practico de cursos.
- Sesiones semanales sin limite practico de negocio.
- Clases por sesion sin limite practico de negocio.
- La planificacion anual del curso queda persistida y no debe regenerarse en el uso normal.

### UX esperada

- Todo lo de BASICO.
- Copiloto en modo `full`.
- Autocomplete de formularios habilitado cuando exista implementacion funcional.
- Puede incorporar fuentes externas adicionales por:
  - URL
  - video
  - busqueda asistida en internet
- Las nuevas fuentes deben quedar vinculadas a una clase o secuencia concreta antes de entrar al flujo de generacion.

### Entregables esperados

- Todo lo de BASICO.

### Restricciones visibles

- La busqueda externa debe estar acotada por materia, curso, planificacion y foco docente.
- Toda fuente online usada debe quedar procesada y persistida antes de generar el entregable.

## Reglas tecnicas de generacion

### Documento curricular

- Puede resolverse desde base local o por indice oficial de ABC.
- Puede importarse desde PDF local o URL.
- La extraccion requiere texto util, no solo imagen escaneada.

### Plan anual

- Debe quedar con:
  - fundamentacion
  - estrategias
  - evaluacion
  - recursos
  - objetivos
  - plan_lessons con `theme`, `justification`, `learning_outcome`, `activities_summary`

### Brief por clase

- Debe estar en `READY_FOR_PRODUCTION` o `PRODUCED` para generar materiales.
- Debe tener bibliografia confirmada util.
- La bibliografia confirmada puede provenir de:
  - nodos curriculares procesados
  - fuentes incorporadas por el docente segun el plan
- La generacion debe consumir solo fuentes autorizadas para ese curso, clase o secuencia.

### Fuentes autorizadas

- `FREE` trabaja con fuentes curriculares base ya cerradas.
- `BASICO` agrega fuentes del docente subidas como archivo.
- `PREMIUM` agrega fuentes del docente por archivo, URL, video o busqueda asistida.
- Toda fuente agregada debe pasar por procesamiento y quedar persistida antes de usarse.
- Las fuentes del docente deben quedar atadas a una clase o a una secuencia concreta, no al sistema completo.

### Material didactico

- Debe incluir:
  - proposito
  - actividad inicial
  - desarrollo
  - producto esperado
  - criterios de logro
  - diferenciacion
  - cierre

### Material de lectura

- Debe cumplir:
  - 1000 a 1300 palabras
  - 2 a 4 paginas PDF
  - tags `data-ref` para trazabilidad
  - cierre con "Fuentes de base del texto:"

## Criterios de aceptacion

### Aceptacion FREE

- Un usuario FREE no puede crear mas de 1 curso.
- No puede preparar 1 o 2 clases desde el flujo de secuencia.
- Puede preparar exactamente 3 clases del mismo curso.
- No puede exportar PDF validado desde la pantalla de leccion.

### Aceptacion BASICO

- Puede crear multiples cursos hasta el limite del plan.
- Puede preparar una secuencia consecutiva larga dentro del mismo curso.
- Puede exportar PDF de materiales validados.
- Puede adjuntar archivos propios del docente para una clase o secuencia y reutilizarlos en la generacion.
- No puede disparar busqueda libre en internet para sumar fuentes nuevas.

### Aceptacion PREMIUM

- Todo lo de BASICO debe seguir funcionando.
- Puede sumar fuentes nuevas por URL, video o busqueda asistida en internet.
- Debe existir una diferencia visible y verificable respecto a BASICO en capacidades de fuentes externas y/o Copiloto.

## Desvios actuales detectados

- La diferencia visible entre BASICO y PREMIUM todavia es debil.
- El exportador PDF frontend simplifica caracteres a ASCII y puede degradar texto en espanol.
- La importacion por URL hoy acepta fuentes externas si se usa la edge function de importacion.
- Las secuencias pagas se ejecutan en una sola invocacion larga y pueden dejar resultados parciales ante error.
- La restriccion bibliografica fuerte hoy depende sobre todo de la UI; backend todavia no valida un universo de fuentes autorizadas por curso/clase/secuencia.
