

# Cambiar datos de prueba de Historia a Filosofia 6to

## Resumen

Se reemplazaran los datos de prueba e2e existentes (curso Historia 5to) por un curso de Filosofia 6to, usando los nodos curriculares del documento de Filosofia ya cargado.

## Cambios en una sola migracion SQL

1. **Borrar datos existentes** (en orden por FK):
   - 2 `lessons`
   - 2 `plan_lessons`
   - 3 `plan_content_mappings`
   - 1 `plan`
   - 1 `course` (Historia 5to)

2. **Insertar nuevos datos** para Filosofia 6to:
   - 1 `course` (Filosofia, year_level=6, academic_year=2025, ACTIVE, usando la misma escuela existente)
   - 1 `plan` (VALIDATED, con fundamentacion sobre filosofia)
   - 3 `plan_content_mappings` vinculando contenidos del Modulo 1 de Filosofia:
     - Filosofia, ciencia e ideologia (c4000001-...-01)
     - Filosofar vs. historia de la filosofia (c4000001-...-02)
     - El pensamiento critico y la pregunta filosofica (c4000001-...-03)
   - 2 `plan_lessons`:
     - Leccion 1: "La filosofia como pensamiento problematizador" (Modulo 1)
     - Leccion 2: "Filosofia, ciencia e ideologia" (Modulo 1, contenido especifico)
   - 2 `lessons` (PLANNED, vinculadas a las plan_lessons)

## Resultado esperado

Al recargar el Dashboard se vera el curso "Filosofia" 6to activo, y se podra navegar el flujo completo hasta el relevamiento con los contenidos curriculares reales de Filosofia PBA.

## Archivos a modificar

Ninguno. Solo migracion SQL.
