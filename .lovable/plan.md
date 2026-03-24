# Plan consolidado: Flexibilizar edicion de clases y busqueda de material

## Resumen

Hay 4 mejoras pendientes que discutimos. Las presento juntas para implementar en orden.

---

## 1. Permitir reabrir un brief confirmado

**Problema actual:** Cuando el brief pasa a `READY_FOR_PRODUCTION` o `PRODUCED`, el formulario queda bloqueado (`isEditable = false` en linea 300). No hay forma de volver a editarlo.

**Cambio en `src/components/lesson/BriefForm.tsx`:**

- Agregar boton "Editar indicaciones" visible cuando `isConfirmed = true` y `!hasInvalidSelections`
- Al presionarlo, actualizar el status del brief a `IN_PROGRESS` via update a `lesson_briefs`
- No eliminar materiales existentes; solo habilitar la re-edicion y futura re-generacion
- Mostrar aviso: "Al modificar las indicaciones podras regenerar los materiales"

---

## 2. Simplificar busqueda premium

**Problema actual:** La edge function `resolve-premium-query` rechaza consultas naturales con `isConcreteQuery` (exige 4+ palabras, tipo de recurso, preposiciones especificas). El frontend muestra un dropdown de tipo de recurso innecesario.

**Cambios:**

`**supabase/functions/resolve-premium-query/index.ts`:**

- Eliminar la funcion `isConcreteQuery` y el bloque que la invoca
- Unica validacion: minimo 2 palabras
- Mantener `inferResourceType` y `extractEntityAndTopic` como metadata (nunca bloquean)

`**src/components/lesson/BriefForm.tsx`:**

- Eliminar state `premiumResourceType` y el dropdown `<Select>`
- Enviar siempre `resource_type: null`
- Layout simplificado: input + boton en una linea con `flex gap-2`
- Agregar soporte Enter para disparar busqueda
- Placeholder: `"Ej: fotosintesis, video revolucion francesa"`
- Quitar texto "Solo se acepta consulta concreta"

---

## 3. Edicion parcial de materiales generados

**Problema actual:** Los materiales didacticos y de lectura son read-only despues de generarse. La unica opcion es regenerar completo.

**Cambios:**

`**src/components/lesson/TeachingMaterialView.tsx`:**

- Agregar boton "Editar" que habilita edicion inline de `purpose`, `expected_product`, `closure` y `achievement_criteria`
- Guardado directo a tabla `teaching_materials` via update
- Mantener boton "Regenerar" como alternativa

`**src/components/lesson/ReadingMaterialView.tsx`:**

- Agregar boton "Editar lectura" que muestra un `<Textarea>` con el HTML para edicion manual
- Guardar cambios a `reading_materials.content_html`
- Recalcular `word_count` al guardar
- Mantener boton "Regenerar" como alternativa

`**src/pages/Lesson.tsx`:**

- Pasar callbacks `onUpdateTeaching` y `onUpdateReading` a los componentes de material para que puedan guardar cambios

---

## Archivos a modificar


| Archivo                                             | Cambios                                                        |
| --------------------------------------------------- | -------------------------------------------------------------- |
| `src/components/lesson/BriefForm.tsx`               | Boton reabrir brief, simplificar busqueda premium              |
| `supabase/functions/resolve-premium-query/index.ts` | Eliminar `isConcreteQuery`, minimo 2 palabras                  |
| `src/components/lesson/TeachingMaterialView.tsx`    | Campos editables inline                                        |
| `src/components/lesson/ReadingMaterialView.tsx`     | Editor de contenido HTML                                       |
| `src/pages/Lesson.tsx`                              | Callbacks de guardado para materiales, handler de reopen brief |


## Orden de implementacion

1. Reabrir brief (cambio pequeno, impacto inmediato)
2. Simplificar busqueda premium (edge function + frontend)
3. Edicion parcial de materiales (mas complejo)