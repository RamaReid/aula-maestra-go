

# Aplicar fix de entorno en Lovable Cloud

## Estado actual

- **Migración `20260305113000`**: Existe en el repo pero NO fue aplicada. La columna `courses.curriculum_document_id` no existe en la base de datos.
- **Edge function `bootstrap-course-plan`**: Sin logs recientes, necesita redeploy con el fix de tipado (`adminClient: any`).

## Pasos de implementación

### Paso 1: Aplicar migración de base de datos
Ejecutar SQL para agregar `curriculum_document_id` a `courses` con FK y índice. Esto es lo que está en la migración `20260305113000`.

### Paso 2: Redeploy de `bootstrap-course-plan`
Forzar deploy de la edge function para que tome el cambio de tipado en `ensureCurriculumNodes`.

### Paso 3: Verificación post-deploy
- Confirmar que `public.courses.curriculum_document_id` existe via query
- Confirmar que `bootstrap-course-plan` deploya sin errores
- Verificar logs de la función

### Paso 4: Actualizar `types.ts`
Tras la migración, el archivo de tipos se regenera automáticamente para incluir `curriculum_document_id` en la interfaz de `courses`.

