
Voy a realizar los ajustes solicitados en el editor de planificación para mejorar la experiencia de usuario y eliminar la redundancia en la pestaña de Fundamentación.

**Cambios a implementar en `src/components/plan/PlanEditor.tsx`**:

1.  **Iconos y Textos**: 
    *   Cambiaré todos los botones que dicen **"Expandir"** por **"Editar"**.
    *   Reemplazaré el icono actual de expandir (`Maximize2`) por un icono de edición (`Pencil`).

2.  **Pestaña Fundamentación**:
    *   Cambiaré el título de "Lectura de la fundamentación" a "Fundamentación".
    *   Eliminaré el área de texto editable (`<Textarea>`) que aparece justo debajo del texto de lectura. De esta manera, solo habrá **un único bloque visible** en la vista normal (solucionando el problema de los "dos placeholders").
    *   Al hacer clic en **"Editar"**, se abrirá el modal de pantalla completa donde podrás escribir y editar el contenido cómodamente.

El resto de las pestañas (`estrategias`, `evaluacion`, `recursos`) también tendrán su botón actualizado a "Editar" para mantener la consistencia en toda la interfaz.
