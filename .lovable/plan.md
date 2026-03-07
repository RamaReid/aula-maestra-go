

# Correcciones visuales Gestalt aplicadas a todas las rutas

El audit anterior solo se planifico pero no se implemento. Ninguna de las correcciones esta aplicada todavia. A continuacion, el plan para aplicar las correcciones en todas las rutas de la aplicacion.

## Cambios globales

### `src/index.css`
- Agregar variable `--brand-accent: 217 91% 60%` (azul medio) en `:root` y en `.dark`.

## Por ruta

### `/` Landing (`src/pages/Landing.tsx`)
1. **Menu hamburguesa mobile**: Agregar boton `Menu` en `md:hidden` que abra un `Sheet` con los links de navegacion.
2. **Mockup mobile**: Crear version compacta del `HeroMockup` visible en `< md` (2 clases, sin tags de materiales).
3. **Acento de marca**: Cambiar `text-primary` en "IA" por `text-[hsl(var(--brand-accent))]` en header, hero y footer.
4. **Iconos negativos en planes**: Items que empiezan con "Sin" usan `Minus` con `text-muted-foreground` en lugar de `CheckCircle2` verde.
5. **Eliminar badges de codigo**: Quitar `StatusBadge` con `label={code}` de las tarjetas de planes.
6. **Conectores en pasos**: Agregar linea horizontal dashed entre los circulos numerados (desktop) y vertical (mobile).
7. **Bloque de diferenciacion**: Agregar 3 puntos concretos debajo del parrafo.

### `/demo` Demo (`src/pages/Demo.tsx`)
8. **Acento de marca**: Agregar "DocencIA" con acento en el header del demo.

### `/login` y `/register` (`src/pages/Login.tsx`, `src/pages/Register.tsx`)
9. **Marca visible**: Agregar "DocencIA" con acento de marca encima del Card en ambas paginas.

### `/dashboard` (`src/pages/Dashboard.tsx`)
10. **Etiquetas de plan legibles**: Mapear "FREE" -> "Gratis", "BASICO" -> "Basico", "PREMIUM" -> "Premium" en badges y selector QA.
11. **Acciones en menu contextual**: Reemplazar botones Archivar y Eliminar visibles en cada card por un `DropdownMenu` con icono `MoreVertical`.

### `/course/:courseId` (`src/pages/Course.tsx`)
12. **Badges de leccion compactos**: En mobile, apilar los badges verticalmente en vez de horizontal para evitar desborde.

### `/course/new` (`src/pages/CourseNew.tsx`)
13. **Barra de progreso visual**: Agregar componente `Progress` debajo del header del wizard mostrando el avance (paso actual / total).

### `/lesson/:lessonId` (`src/pages/Lesson.tsx`)
14. Sin cambios criticos de Gestalt pendientes; las etiquetas de trazabilidad se mantienen por ahora dado que cumplen funcion informativa en contexto.

### `/curriculum/import` (`src/pages/CurriculumImport.tsx`)
15. Sin cambios criticos; la pagina ya sigue el patron visual de Card centrada.

## Archivos a modificar
- `src/index.css` (1 linea)
- `src/pages/Landing.tsx` (correcciones 1-7)
- `src/pages/Demo.tsx` (correccion 8)
- `src/pages/Login.tsx` (correccion 9)
- `src/pages/Register.tsx` (correccion 9)
- `src/pages/Dashboard.tsx` (correcciones 10-11)
- `src/pages/Course.tsx` (correccion 12)
- `src/pages/CourseNew.tsx` (correccion 13)

