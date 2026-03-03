## Curriculum Seed Data

Esta carpeta es el staging manual para programas oficiales de la Provincia de Buenos Aires.

La aplicacion no debe leer estos archivos en runtime. Su funcion es servir como fuente de ingesta
para poblar:

- `public.curriculum_documents`
- `public.curriculum_nodes`

### Donde subir los PDFs

Colocar los PDFs oficiales en:

- `supabase/seed_data/curriculum/pba/pdfs/`

### Manifest obligatorio

Cada PDF debe tener una entrada en:

- `supabase/seed_data/curriculum/pba/manifest.json`

Ese archivo define los metadatos que no conviene inferir solo desde el nombre del PDF:

- `subject`
- `cycle`
- `year_level`
- `school_type`
- `orientation`
- `speciality`
- `official_title`
- `official_url`

### Como usar `school_type`

- usar `null` cuando el mismo programa aplica a mas de un tipo de escuela
- usar `COMUN` o `TECNICA` solo cuando el documento sea especifico de ese tipo

Ejemplo:

- `Filosofia` de 6to puede quedar con `school_type: null` si aplica tanto a comun como a tecnica
- `Filosofia e historia de la ciencia y la tecnologia` debe quedar con restricciones en `null` si el mismo documento se usa tambien en tecnica o agraria

### Convencion de nombres sugerida

El nombre local no necesita ser identico al de ABC. Debe ser estable y facil de mantener.

Ejemplos:

- `pba_secundaria_6_filosofia.pdf`
- `pba_secundaria_6_filosofia_historia_ciencia_tecnologia_cn.pdf`
- `pba_secundaria_6_historia.pdf`
- `pba_secundaria_ciclo_superior_matematica.pdf`

### Regla de trazabilidad

Aunque el nombre del archivo local sea practico, al importar debe persistirse en DB:

- `official_title`
- `official_url`
- `source_provider`
- `content_hash`
- `fetched_at`

### Alcance actual

En esta etapa, esta carpeta funciona como deposito manual de PDFs oficiales hasta completar el
flujo de ingesta y estructuracion curricular.

### Importacion

El importador local recorre `manifest.json`, extrae el texto completo del PDF y actualiza:

- `public.curriculum_documents`
- `public.curriculum_nodes`

Comando:

```bash
npm run import:curriculum
```

Requisitos:

- `npm install`
- `SUPABASE_SERVICE_ROLE_KEY` disponible en el entorno o en `.env.local`

Prueba sin escribir en DB:

```bash
node scripts/import-curriculum-pdfs.mjs --dry-run
```
