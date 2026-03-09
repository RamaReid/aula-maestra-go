
**Modificación de la pestaña "Contenidos" para ocultar la trazabilidad técnica**

He analizado la estructura de la pestaña "Contenidos" dentro de `PlanEditor.tsx`. Actualmente, debajo del editor de bloques anuales (`PlanContentBlocksEditor`), se está renderizando una tarjeta visible y desplegada por defecto con el listado completo de los nodos crudos del anclaje curricular, lo que efectivamente ensucia la lectura.

### Cambios a realizar

1.  **Relegar el Anclaje Curricular a una Capa Secundaria (`src/components/plan/PlanEditor.tsx`)**
    Modificaremos el bloque de "Anclaje curricular mapeado" para que deje de ser una tarjeta visible a simple vista. En su lugar, lo envolveremos dentro de un componente `Accordion` colapsado por defecto, tratándolo como un metadato técnico/interno.

    *   **Vista por defecto:** Se verá únicamente el título y el editor de los bloques anuales de contenido (con sus temas, descripciones y unidades), dejando la pantalla completamente limpia.
    *   **Capa técnica (Expandible):** Al final de la vista se añadirá un pequeño texto/botón discreto (ej: *"Ver detalles técnicos de trazabilidad curricular"*). Solo si el docente o el sistema necesitan auditar de dónde viene el plan, podrán desplegarlo para ver la lista de nodos.

2.  **Importar y aplicar los componentes visuales necesarios**
    *   Importaremos `Accordion`, `AccordionItem`, `AccordionTrigger` y `AccordionContent` desde `@/components/ui/accordion`.
    *   Añadiremos un estilo sutil y atenuado (colores `muted` y fuentes pequeñas) para la lista de nodos crudos, reafirmando que no es contenido de lectura principal.

3.  **Mantener la funcionalidad intacta**
    *   La trazabilidad del sistema y los metadatos internos (`visibleMappedNodes`) seguirán presentes en el DOM y en el estado del componente, garantizando que el PDF exportable y la base de datos sigan funcionando correctamente sin verse afectados por esta limpieza de la interfaz.

