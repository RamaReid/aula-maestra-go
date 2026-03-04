# Canon Index

This folder makes explicit which sources define the expected behavior of the app.

## Purpose

The product should not depend on a loose prompt or on a single AI output. It should depend on a clear hierarchy of truth:

1. Official curriculum and course identity
2. Golden pedagogical reference already accepted by the project
3. Operational canon of the app
4. Implementation details in code

## Source Hierarchy

### 1. Official curriculum is the content source

These files define the disciplinary frame and the content structure:

- `supabase/seed_data/curriculum/pba/pdfs/*`
- imported `curriculum_documents`
- imported `curriculum_nodes`
- external references used in prior analysis:
  - `ProgramaFilosofia`
  - `ProgramaFilosofiaCienciaTecnica`

Rule:

- `Filosofia` uses the FIL frame: modules and problems.
- `Filosofia e Historia de la Ciencia y la Tecnologia` uses the CN frame: units and cases.
- The app must not merge FIL and CN logic into a single undifferentiated canon.

### 2. Golden reference is the accepted product quality

The current golden pedagogical reference for `FyHyCyT 6 EESA` is already inside the repo:

- `src/pages/Demo.tsx`

This file is not just a demo screen. It is the best current example of:

- annual planning quality
- agenda quality
- sequence quality
- single class quality
- reading material quality

The project also has an external accepted annual planning example for the same subject and context. Its logic is captured in `docs/CANON_GOLDEN_FYHCT_6EESA.md`.

### 3. Operational canon defines how the app should behave

Use:

- `docs/CANON_OPERATIONAL.md`

This document explains:

- what the app must preserve across planning, sequence, class, and reading material
- what the AI is allowed to do
- what the AI must not be framed as

### 4. Code is implementation, not product truth

The current implementation lives mainly in:

- `supabase/functions/bootstrap-course-plan/index.ts`
- `supabase/functions/generate-materials/index.ts`
- `src/pages/CourseNew.tsx`
- `src/pages/Course.tsx`
- `src/pages/Lesson.tsx`
- `src/components/plan/*`

Rule:

- If code behavior conflicts with the official curriculum or the golden reference, code should be corrected.
- The canon should not be reverse-engineered from accidental implementation limits.

## AI Role

The AI in this project is not the product.

It is:

- a transformation engine over curricular and pedagogical inputs
- an assistant for drafting documents
- a coherence checker
- a contextual adapter
- a state-aware layer over a live system

It is not:

- a replacement teacher
- a free text generator without constraints
- a chat product disconnected from course state

## Change Policy

The following should not be changed without explicit approval:

- the accepted golden quality of `src/pages/Demo.tsx`
- the FIL versus CN split
- the idea that each annual lesson ends in a concrete minimum evidence
- the product framing of AI as an assistant engine, not as the main product
