

## Fix: Elementos del sidebar del Copiloto se tapan entre sí

El problema es que el botón de cierre (X) del `SheetContent` tiene posición absoluta (`absolute right-4 top-4`) y se superpone con el `Badge` "Premium" en el header.

### Cambios

1. **`src/components/lesson/CopilotSheetTrigger.tsx`** — Agregar `pr-10` al header row para dejar espacio al botón X del Sheet, evitando que se tape con el Badge.

2. **`src/components/lesson/CopilotChat.tsx`** — Cambiar el layout del chat para que use `flex-1` con `min-h-0` en vez de `h-[300px]` fijo, permitiendo que el área de mensajes ocupe todo el espacio disponible sin desbordarse, y el input quede siempre fijo abajo.

3. **`src/components/lesson/CopilotSheetTrigger.tsx`** — Reestructurar el contenido interior: el `ScrollArea` debe tener `min-h-0 flex-1` y el chat debe estar en un contenedor flex que ocupe todo el alto disponible, con el input del chat siempre visible al fondo (fuera del scroll).

