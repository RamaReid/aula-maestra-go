
# PRD-V1 — INFORME DE VERIFICACION INTEGRAL DEL SOD

## Estado General: APROBADO CON OBSERVACIONES — 14 grietas detectadas, 10 remediadas

---

## Grietas Remediadas

| ID | Fix | Descripcion |
|----|-----|-------------|
| M-2 | ✅ | Validación de subtítulos HTML `<h1>`-`<h6>` agregada al pipeline ReadingMaterial |
| M-3 | ✅ | Lock atómico: `UPDATE lessons SET is_generating=true WHERE id=X AND is_generating=false` con verificación de affected rows |
| M-1 | ✅ | Validación post-AI para TeachingMaterial: purpose, activities, expected_product, achievement_criteria, closure, differentiation no vacíos |
| G-1 | ✅ | `max_classes_per_session` ahora limita lessons por invocación, no acumulado semanal |
| G-2 | ✅ | Endpoint acepta `{ lesson_ids: [...], mode: "full_session" }` con backward compatibility para `lesson_id` |
| G-3 | ✅ | `sessions_used_this_week` se incrementa solo 1 vez por invocación (sesión), no por lesson |

## Grietas Pendientes (Foundation — requiere PRD 1.2 Completion)

| ID | Modulo | Descripcion |
|----|--------|-------------|
| F-1 a F-8 | Foundation | No hay Wizard, no hay edición/validación de Plan, no hay Agenda |
| F-9 | Foundation | No hay gestión de ARCHIVED en UI |

## Grietas Menores Pendientes

| ID | Modulo | Descripcion |
|----|--------|-------------|
| S-1 | Seguridad | config.toml sin verify_jwt explícito (funciona con signing keys) |
| C-1 | Consistencia | Default GENERATED nunca usado (vestigio) |
| C-2 | Consistencia | Posible VALIDATED sin pdf_url en edge case extremo |

## Próximo Sprint

PRD 1.2 Completion: Wizard de curso, edición/validación de Plan, Agenda.
