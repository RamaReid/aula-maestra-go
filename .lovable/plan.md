# Plan: Instrumentacion de usage + E2E manual

Paso 0 — Consistencia UI del selector de plan (previo a E2E)

Objetivo:

- El placeholder del selector de plan debe aparecer en la misma ubicación visual, con el mismo alineado y spacing, en cualquier dashboard donde se muestre.

Alcance mínimo:

- Dashboard principal

- Dashboard de curso

- Dashboard de billing (si aplica selector)

Criterio de aceptación:

- Misma posición relativa dentro del contenedor (header/toolbar).

- Mismo ancho/alto, padding y alineación de texto del placeholder.

- No “salta” de posición entre vistas responsive desktop/mobile.

Evidencia obligatoria:

- 1 captura por dashboard (desktop)

- 1 captura en mobile

- Nota de validación indicando que usa el mismo componente/estilo compartido.

&nbsp;

## Paso 1 — Instrumentar callAI en generate-materials (commit temporal)

En `supabase/functions/generate-materials/index.ts`, linea 537, reemplazar:

```typescript
// Antes:
return await resp.json();

// Despues:
const fullResponse = await resp.json();
console.log("AI_USAGE_LOG", JSON.stringify({
  model: fullResponse.model,
  id: fullResponse.id,
  usage: fullResponse.usage,
  feature: "generate-materials",
}));
return fullResponse;
```

NO tocar bootstrap-course-plan (solo si hace falta).

## Paso 2 — Deploy generate-materials

Re-deploy para que el log quede activo antes de la ejecucion E2E.

## Paso 3 — Autenticacion

La session replay muestra que estas en la pantalla de login. Necesito que te loguees como `rgarciareid@gmail.com` en el preview y me avises. Una vez logueado, ejecuto el flujo completo via browser automation.

## Paso 4 — E2E via browser automation

1. Crear curso (FyHyCyT 6to)
2. Esperar bootstrap del plan
3. Validar plan
4. Abrir clase 1, completar brief (enfoque, dinamica, profundidad, 1-5 fuentes curriculares)
5. Confirmar brief (READY_FOR_PRODUCTION)
6. Ejecutar generar materiales
7. Capturar resultados en pantalla

## Paso 5 — Recolectar evidencia

- Queries SQL para IDs y estados finales
- Edge function logs para capturar AI_USAGE_LOG (ejemplo anonimizado)
- Actualizar `docs/CONTEXT_EVIDENCE_REPORT.md` y `docs/evidence/`

## Paso 6 — Commit de limpieza

Revertir el `console.log` de AI_USAGE_LOG en generate-materials, deploy limpio.

## Archivos a modificar


| Archivo                                              | Cambio                         | Commit     |
| ---------------------------------------------------- | ------------------------------ | ---------- |
| `supabase/functions/generate-materials/index.ts:537` | Agregar log de `usage`         | Temporal   |
| `docs/CONTEXT_EVIDENCE_REPORT.md`                    | Seccion E2E + seccion costo IA | Permanente |
| `docs/evidence/logs_extract.txt`                     | Ejemplo usage anonimizado      | Permanente |
| `docs/evidence/e2e_run_ids.txt`                      | IDs reales del E2E             | Permanente |
| `supabase/functions/generate-materials/index.ts:537` | Revertir log                   | Limpieza   |


## Bloqueante

**Necesito que te loguees en el preview** con el usuario QA antes de poder ejecutar pasos 4-6. Logueate y avisame.

DoD adicional UI:

- Placeholder del plan consistente en todos los dashboards antes de ejecutar E2E.

&nbsp;