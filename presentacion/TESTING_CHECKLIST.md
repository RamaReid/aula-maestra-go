# TESTING CHECKLIST

## Pruebas automatizadas presentes

- `src/test/courseSelectionRules.test.ts`
- `src/test/pdfExport.test.ts`
- `src/test/example.test.ts`

Cobertura real actual:

- reglas de seleccion de clases
- export PDF estructurada
- smoke test minimo

## Checklist funcional

### Auth y acceso

- [ ] Registro crea usuario y perfil.
- [ ] Login por email/password entra al dashboard.
- [ ] Login con Google devuelve sesion valida.
- [ ] Logout limpia la sesion y vuelve a pantalla publica.

### Landing y demo

- [ ] Landing carga CTAs y comparativa de planes.
- [ ] Demo abre sin login.
- [ ] Demo muestra tabs y banner de modo no persistente.

### Dashboard

- [ ] Lista cursos activos y archivados.
- [ ] Muestra error si falla la carga de cursos.
- [ ] Muestra plan activo y limites efectivos.
- [ ] Permite archivar y borrar curso.

### Curriculum

- [ ] `Sincronizar ABC` lista documentos verificados.
- [ ] Importacion por URL oficial de `abc.gob.ar` responde correctamente.
- [ ] Importacion manual por archivo crea documento usable.
- [ ] Seleccionar curriculum existente lleva a `Nuevo curso` con parametros.

### Alta de curso

- [ ] El wizard completa los 8 pasos.
- [ ] Crear escuela nueva funciona.
- [ ] Resolver curriculum devuelve uno o varios candidatos.
- [ ] Si el plan no permite mas cursos, se bloquea la creacion.
- [ ] Al crear curso se generan plan y clases base.

### Plan anual

- [ ] El curso carga plan, bloques, objetivos y clases.
- [ ] Editar campos cambia el estado del plan a `EDITED`.
- [ ] `Validar plan` actualiza estado a `VALIDATED`.
- [ ] `Regenerar borrador` vuelve a poblar el plan.
- [ ] Export PDF del plan funciona.

### Agenda y lecciones

- [ ] La agenda toma horarios de `course_schedule_slots`.
- [ ] Las lessons se pueden abrir desde curso o agenda.
- [ ] La leccion muestra canon, curriculum y bibliografia.

### Brief y fuentes

- [ ] Guardar brief crea o actualiza `lesson_briefs`.
- [ ] Bibliografia curricular puede confirmarse.
- [ ] Upload de archivo docente crea `authorized_source`.
- [ ] Procesamiento extrae texto del archivo.
- [ ] Consulta premium devuelve candidatos solo en planes que correspondan.

### Generacion

- [ ] `generate-materials` crea material didactico.
- [ ] `generate-materials` crea lectura.
- [ ] Mientras genera, la leccion muestra estado bloqueante.
- [ ] Si falla validacion de lectura, se muestran razones.

### Exportacion

- [ ] Lectura validada permite descarga PDF.
- [ ] Fallback de PDF desde storage funciona.
- [ ] Si no hay persistencia, la UI avisa que el PDF es temporal.

### Billing

- [ ] Billing muestra suscripcion actual.
- [ ] Checkout devuelve URL de Mercado Pago.
- [ ] Reconciliacion refresca el estado local.
- [ ] Cancelacion de suscripcion funciona para Mercado Pago.
- [ ] Solicitud manual se guarda en `manual_payment_requests`.

## Casos clave para demo

- [ ] Usuario `FREE` puede recorrer landing -> login -> dashboard -> curso demo / curso real.
- [ ] Usuario `BASICO` puede preparar secuencia consecutiva.
- [ ] Usuario `PREMIUM` puede usar chat y fuentes premium.

## Riesgos a probar antes del hackathon

- [ ] Secretos de IA presentes.
- [ ] Secretos de billing presentes si se va a mostrar checkout real.
- [ ] Bucket `authorized-sources` operativo.
- [ ] Bucket `reading-materials-pdf` operativo.
- [ ] Proyecto Supabase apuntado coincide con el deploy usado en demo.
