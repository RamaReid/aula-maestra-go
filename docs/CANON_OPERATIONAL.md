# Canon Operational

This document defines the operational canon of the app.

It is not a prompt and it is not a pedagogical bureaucracy pack. It is the product-level rule set that should keep outputs aligned with the intended experience.

## Product Core

The star flow of the app is:

`official program -> annual plan -> sequence or class -> reading material`

Everything else is secondary to this flow.

## Role of AI in the App

AI should be understood as an integrated assistance engine inside a system with state.

Its job is to:

- transform curricular and course data into usable drafts
- generate first versions of annual plans, sequences, classes, and reading materials
- verify internal coherence across course, plan, lesson, timing, and bibliography
- adapt outputs to context without losing structure
- reduce operational workload while preserving teacher control
- keep production traceable to real inputs

AI should not be framed as:

- "the thing that teaches instead of the teacher"
- "an automatic text machine"
- "a loose GPT chat"

Short product formulation:

`The AI is not the product. It is the engine that makes the teacher system operational, adaptable, and verifiable.`

## Canon by Layer

### 1. Official program resolution

The system must resolve the right program using:

- subject
- cycle
- year
- school type
- orientation or speciality when required

The output is not just a document id. It is the curricular anchor for all later production.

### 2. Annual plan

The annual plan is the main product requested by the teacher.

It must:

- be anchored to the official program
- be situated to the course context
- remain editable
- be traceable to the curriculum
- be usable as the source for sequences, classes, and materials

Required qualities:

- clear disciplinary frame
- coherent yearly progression
- explicit evaluation logic
- low-tech viability
- bibliography separated into teacher and students when applicable

For yearly scheduling, the canonical pattern is:

- 28 classes total
- 14 classes per term
- each class should resolve as a small pedagogical unit

For `FyHyCyT 6 EESA`, the accepted annual pattern is:

1. focus or theme
2. operation or pedagogical move
3. minimum evidence

That three-part shape is more useful for the app than a theme-only schedule.

Minimum rule:

- an annual lesson is not complete if it only has a title
- it should imply what the class does and what visible output it leaves

### 3. Sequence

A sequence is not just a group of lessons by topic.

It should:

- connect several lessons through a shared problem or production
- make continuity visible from one lesson to the next
- show how each lesson advances the work
- keep outputs cumulative rather than isolated

Useful continuity markers:

- what this lesson takes from the previous one
- what it leaves ready for the next one
- what evidence it adds to the sequence

### 4. Single class

A class should not be generated as generic prose plus activities.

At minimum, a class should make explicit:

- purpose
- lesson focus
- timing or working structure
- reading support if needed
- concrete activity path
- minimum evidence
- recovery equivalent when relevant
- low-tech fallback
- accessibility or support adjustments when needed

The class should feel like a real teachable unit, not a list of ideas.

### 5. Reading material

Reading material is not a summary, not a worksheet, and not a bullet list.

It should:

- be written as continuous prose
- support the exact lesson or sequence purpose
- stay aligned with the plan and the bibliography selected for that lesson
- be conceptually serious but usable at school level
- avoid drifting away from the curricular frame

Reading material should be traceable:

- what lesson it belongs to
- what bibliography nodes support it
- what concepts or cases it develops

## Discipline Split

### Filosofia

Keep the FIL logic:

- modules and problems
- concepts, positions, arguments, objections
- thesis with reasons
- philosophical dialogue and writing

Do not collapse FIL into experimental design or generic science workflow.

### Filosofia e Historia de la Ciencia y la Tecnologia

Keep the CN logic:

- units and cases
- philosophy of science, history of science, and technology together
- analysis of validation, evidence, methods, and decisions
- situated cases linked to real school practice

Do not flatten FyHyCyT into pure FIL or pure science technique.

## Traceability Rules

Every relevant output should be traceable to:

- course identity
- curriculum anchor
- annual plan
- lesson focus
- bibliography or curriculum nodes used

This does not require exposing raw prompts to the user. It requires preserving enough structure so the system can explain where a draft comes from.

## Anti-Patterns

The app should avoid these outputs:

- annual plans that only list themes
- lessons with no visible evidence
- reading materials that are generic summaries disconnected from the plan
- sequence outputs with no continuity
- AI outputs that ignore school context
- formal documents polluted with prompt language or meta instructions

## Current Golden Reference

For the current project stage, `FyHyCyT 6 EESA` in `src/pages/Demo.tsx` is the strongest accepted quality reference and should guide future canon decisions unless an explicit replacement is approved.
