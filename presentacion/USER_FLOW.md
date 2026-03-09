# USER FLOW

## 1. Entrada publica

### Landing

El recorrido empieza en `/`:

- el usuario entiende la propuesta
- compara planes
- decide si ver demo, registrarse o iniciar sesion

### Demo

Si entra a `/demo`, ve un caso armado sin guardar cambios. Este flujo sirve para pitch y video aun sin datos propios cargados.

## 2. Autenticacion

El usuario puede:

- registrarse
- iniciar sesion con email y password
- entrar con Google

Al autenticarse, la app carga perfil y plan efectivo.

## 3. Dashboard

Desde `/dashboard` el usuario:

- ve sus cursos
- identifica si esta en `FREE`, `BASICO` o `PREMIUM`
- crea un curso nuevo
- entra a billing
- entra a sincronizar curriculum

Si no tiene cursos, el CTA principal lo lleva al wizard de alta.

## 4. Alta de curso

El flujo normal es:

1. elegir provincia
2. elegir materia
3. elegir o crear escuela
4. elegir ciclo
5. elegir año
6. definir contexto de cursada y horarios
7. resolver el programa oficial
8. confirmar

Resultado:

- se crea el curso
- se guarda el horario semanal
- se crea el plan anual
- se crean 28 clases base
- se ejecuta el bootstrap del plan

## 5. Si falta curriculum

Si el diseño no aparece resuelto:

1. el usuario entra a `/curriculum/import`
2. prueba URL oficial de `abc.gob.ar` o carga manual
3. importa / selecciona un documento verificado
4. vuelve a `/course/new` con `curriculum_document_id`

## 6. Trabajo dentro del curso

En `/course/:courseId` el recorrido sigue con tres zonas:

- planificacion anual
- agenda
- lecciones

### Planificacion

El docente revisa y corrige:

- fundamentacion
- objetivos
- bloques
- rubricas
- bibliografia
- clases

Luego valida el plan.

### Agenda

La agenda usa el horario semanal y las clases del plan para mostrar el recorrido de cursada.

### Lecciones

El usuario entra a una clase especifica para preparar materiales.

## 7. Preparacion de clase

En `/lesson/:lessonId` el flujo es:

1. revisar tema, canon y anclaje curricular
2. completar brief docente
3. confirmar bibliografia
4. agregar fuentes propias o premium si el plan lo permite
5. generar materiales
6. revisar salida
7. exportar si esta validada

## 8. Diferencias por plan

### FREE

- maximo 1 curso activo
- secuencia exacta de 3 clases
- sin exportacion PDF validada plena
- sin fuentes premium
- sin copiloto full

### BASICO

- multiples cursos
- secuencias consecutivas
- PDF validado
- fuentes propias por archivo
- copiloto limitado

### PREMIUM

- agrega fuentes por URL/video
- agrega busqueda premium guiada
- agrega chat del copiloto

## 9. Billing

Desde `/billing` el usuario puede:

- revisar su plan actual
- iniciar checkout
- reconciliar estado
- cancelar suscripcion
- dejar solicitud manual

## 10. Flujo de demo recomendado para jurado

Si se necesita mostrar valor rapido:

1. landing
2. demo
3. dashboard
4. curso
5. plan validado
6. lesson con brief y materiales
7. billing
