# Matriz QA por Plan

Fecha de referencia: 2026-03-06

## Uso

- Estado inicial: `Pendiente`
- Marcar evidencia real:
  - captura
  - id de curso
  - id de leccion
  - respuesta de edge function

## 1. Alta de curso

| ID | Plan | Escenario | Resultado esperado | Estado |
| --- | --- | --- | --- | --- |
| QA-COURSE-01 | FREE | Crear primer curso con programa resuelto | Curso creado, plan creado, bootstrap ejecutado | Pendiente |
| QA-COURSE-02 | FREE | Intentar crear segundo curso | Bloqueo por limite de plan | Pendiente |
| QA-COURSE-03 | BASICO | Crear multiples cursos | Permitido hasta 15 | Pendiente |
| QA-COURSE-04 | PREMIUM | Crear multiples cursos | Permitido sin limite practico | Pendiente |
| QA-COURSE-05 | ALL | Resolucion curricular ambigua | UI obliga seleccion manual | Pendiente |
| QA-COURSE-06 | ALL | Importacion PDF local | Documento importado, texto extraido, nodos creados | Pendiente |
| QA-COURSE-07 | ALL | URL remota no PDF | Error controlado | Pendiente |

## 2. Plan anual

| ID | Plan | Escenario | Resultado esperado | Estado |
| --- | --- | --- | --- | --- |
| QA-PLAN-01 | FREE | Apertura de curso nuevo | Validacion en segundo plano y exposicion de secuencia/clases | Pendiente |
| QA-PLAN-02 | BASICO | Validar plan desde editor | Plan pasa a `VALIDATED`, se crean lecciones | Pendiente |
| QA-PLAN-03 | PREMIUM | Editar plan validado | Plan pasa a `EDITED`, requiere revalidacion | Pendiente |
| QA-PLAN-04 | ALL | Plan incompleto | `validate_plan` devuelve errores utiles | Pendiente |

## 3. Brief y trazabilidad

| ID | Plan | Escenario | Resultado esperado | Estado |
| --- | --- | --- | --- | --- |
| QA-BRIEF-01 | ALL | Brief incompleto | No permite generar | Pendiente |
| QA-BRIEF-02 | ALL | Brief sin bibliografia confirmada | Error de generacion controlado | Pendiente |
| QA-BRIEF-03 | BASICO/PREMIUM | Copiloto limited/full | Panel habilitado segun plan | Pendiente |
| QA-BRIEF-04 | FREE | Copiloto none | Panel bloqueado o sin capacidad operativa | Pendiente |
| QA-BRIEF-05 | BASICO | Adjuntar PDF o imagen docente | Fuente queda procesada y disponible para esa clase/secuencia | Pendiente |
| QA-BRIEF-06 | PREMIUM | Adjuntar URL o video | Fuente queda procesada y disponible para esa clase/secuencia | Pendiente |
| QA-BRIEF-07 | PREMIUM | Buscar fuente externa con foco acotado | Resultado trazable y persistido antes de generar | Pendiente |
| QA-BRIEF-08 | ALL | Intentar usar fuente fuera del curso | Backend la rechaza | Pendiente |
| QA-BRIEF-09 | PREMIUM | Consulta concreta con typo en autor/video | Matching difuso propone opciones y exige aprobacion docente | Pendiente |

## 4. Generacion de materiales

| ID | Plan | Escenario | Resultado esperado | Estado |
| --- | --- | --- | --- | --- |
| QA-GEN-01 | FREE | Preparar exactamente 3 clases | Sesion exitosa | Pendiente |
| QA-GEN-02 | FREE | Preparar 1 o 2 clases desde curso | Bloqueo en UI o backend | Pendiente |
| QA-GEN-03 | FREE | Preparar 4 clases | Bloqueo en UI o backend | Pendiente |
| QA-GEN-04 | BASICO | Preparar 1 clase | Sesion exitosa | Pendiente |
| QA-GEN-05 | BASICO | Preparar secuencia consecutiva | Sesion exitosa | Pendiente |
| QA-GEN-06 | BASICO | Preparar secuencia no consecutiva | Bloqueo por regla de secuencia | Pendiente |
| QA-GEN-07 | PREMIUM | Preparar secuencia larga | Sesion exitosa o error controlado sin inconsistencia parcial visible | Pendiente |
| QA-GEN-08 | ALL | Generacion con leccion ya bloqueada | Error controlado | Pendiente |
| QA-GEN-09 | ALL | Regenerar solo didactico | `teaching_materials` se actualiza | Pendiente |
| QA-GEN-10 | ALL | Regenerar solo lectura | `reading_materials` y PDF se actualizan | Pendiente |
| QA-GEN-11 | BASICO | Generar con archivo docente procesado | El prompt usa solo fuentes curriculares y archivo autorizado | Pendiente |
| QA-GEN-12 | PREMIUM | Generar con URL/video procesado | El prompt usa solo fuentes curriculares y fuentes premium autorizadas | Pendiente |
| QA-GEN-13 | ALL | Fuente autorizada en `PENDING` o `FAILED` | Bloqueo controlado antes de generar | Pendiente |

## 5. Validacion del entregable

| ID | Plan | Escenario | Resultado esperado | Estado |
| --- | --- | --- | --- | --- |
| QA-OUT-01 | ALL | Material didactico validado | Estructura completa visible | Pendiente |
| QA-OUT-02 | ALL | Material de lectura validado | 1000-1300 palabras y trazabilidad visible | Pendiente |
| QA-OUT-03 | ALL | Material de lectura invalidado | Razones visibles en UI | Pendiente |
| QA-OUT-04 | ALL | Bibliografia referenciada | `data-ref` visible via trazabilidad | Pendiente |

## 6. PDF y exportacion

| ID | Plan | Escenario | Resultado esperado | Estado |
| --- | --- | --- | --- | --- |
| QA-PDF-01 | FREE | Material validado con lectura | PDF temporal, sin export validado | Pendiente |
| QA-PDF-02 | FREE | PDF generado | Watermark presente | Pendiente |
| QA-PDF-03 | BASICO | Material didactico validado | Boton `Exportar PDF` visible y funcional | Pendiente |
| QA-PDF-04 | BASICO | Material de lectura validado | Descarga PDF persistida funcional | Pendiente |
| QA-PDF-05 | PREMIUM | Igual que BASICO | Funciona igual o mejor | Pendiente |
| QA-PDF-06 | BASICO/PREMIUM | Export con caracteres acentuados | PDF preserva texto correctamente | Pendiente |

## 7. Limites y contadores

| ID | Plan | Escenario | Resultado esperado | Estado |
| --- | --- | --- | --- | --- |
| QA-LIMIT-01 | FREE | Agotar 2 sesiones semanales | Tercera sesion bloqueada | Pendiente |
| QA-LIMIT-02 | BASICO | Multiples sesiones | No bloqueo por contador semanal | Pendiente |
| QA-LIMIT-03 | PREMIUM | Multiples sesiones | No bloqueo por contador semanal | Pendiente |

## 8. Cierre tecnico

| ID | Tipo | Escenario | Resultado esperado | Estado |
| --- | --- | --- | --- | --- |
| QA-TECH-01 | FE | `npm run build` | Compila sin errores | Pendiente |
| QA-TECH-02 | FE | `npm run test` | Tests verdes | Pendiente |
| QA-TECH-03 | BE | Edge function `generate-materials` con fixture | Respuesta consistente | Pendiente |
| QA-TECH-04 | BE | Error durante secuencia larga | Sin inconsistencias invisibles para el usuario | Pendiente |

## Defectos a vigilar

- Diferencia real entre BASICO y PREMIUM.
- Degradacion del PDF exportado desde frontend.
- Importacion por URL externa no oficial.
- Sesiones largas pagas con resultados parciales.
- Universo bibliografico no suficientemente cerrado en backend por curso, clase o secuencia.
