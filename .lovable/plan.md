

## Plan: Copiloto como panel lateral persistente (side-by-side)

Reemplazar el `Sheet` (drawer overlay) por un layout de dos columnas con `ResizablePanel` para que el Copiloto ocupe un panel lateral fijo al lado del contenido principal. El usuario puede trabajar en ambos simultáneamente.

### Cambios

1. **`src/pages/Lesson.tsx`** — Reemplazar la estructura actual de `<main>` con un `ResizablePanelGroup` horizontal:
   - Panel izquierdo (default ~65%): contenido actual de la lección (brief, materiales, canon)
   - Panel derecho (default ~35%, min 25%): Copilot panel/chat, visible cuando el usuario lo abre via botón en header
   - Estado `copilotOpen` (boolean) controlado por el botón del header. Cuando está cerrado, el contenido ocupa 100%.
   - El botón en el header cambia de `CopilotSheetTrigger` a un simple `Button` que hace toggle de `copilotOpen`.

2. **`src/pages/Lesson.tsx`** — El panel derecho del Copiloto contendrá directamente el header (Copiloto + badge + botón cerrar) y el contenido (`CopilotPanel` o `CopilotChat`) con scroll independiente via `ScrollArea`.

3. **`src/pages/Course.tsx`** — Mantener el `CopilotSheetTrigger` como Sheet/drawer en la página de curso (donde no hay trabajo simultáneo intensivo). Sin cambios.

4. **No se elimina `CopilotSheetTrigger.tsx`** — sigue usándose en Course.tsx. En Lesson.tsx se reemplaza por el panel inline.

### Estructura visual

```text
┌─ Header ──────────────────────────────────────┐
│ ← Volver  │ Lección N — Tema │ [Copiloto] btn │
├───────────────────────┬───────────────────────┤
│                       │ ┌───────────────────┐ │
│   Contenido lección   │ │ Copiloto IA  [×]  │ │
│   (scroll propio)     ↕ │ ─────────────────  │ │
│                       │ │ Panel / Chat       │ │
│                       │ │ (scroll propio)    │ │
│                       │ │                    │ │
│                       │ │ [input ───] [↑]    │ │
│                       │ └───────────────────┘ │
└───────────────────────┴───────────────────────┘
```

### Detalles técnicos
- Usa `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` ya disponibles en el proyecto
- El panel del Copiloto tiene `minSize={25}` y `defaultSize={35}`
- Al cerrar, se oculta el panel derecho y el handle, el panel izquierdo pasa a 100%
- Ambos paneles usan `overflow-y-auto` independiente para scroll separado

