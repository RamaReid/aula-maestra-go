

# Redeploy de Edge Functions

El codigo fuente ya contiene todas las funcionalidades descritas. Solo falta forzar el redeploy de ambas edge functions para que el entorno de ejecucion refleje la version actual del repositorio.

## Paso 1: Redeploy `bootstrap-course-plan`
Forzar deploy de la edge function. Incluye:
- Filtrado de ruido institucional/portada (`isCurriculumNoiseNode`, `isCurriculumNoiseText`)
- Separacion de nodos curriculares vs bibliograficos (`buildNodePools`)
- Fix de tipado `adminClient: any`

## Paso 2: Redeploy `generate-materials`
Forzar deploy de la edge function. Incluye:
- Validacion de bibliografia real (`isLikelyBibliographySource`)
- Parrafo final de trazabilidad (`buildReadingSourcesParagraph`)
- Tags `data-ref` obligatorios en validacion
- Validacion de "Fuentes de base del texto" en `validateReadingMaterial`

## Paso 3: Verificacion post-deploy
- Confirmar logs de ambas funciones sin errores
- Probar generacion de materiales en una leccion con brief confirmado

No hay cambios de codigo necesarios. Solo redeploy.

