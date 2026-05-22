# DocencIA

Working repository: `aula-maestra-go`

DocencIA is an AI-assisted web platform for secondary school teachers. It concentrates curriculum selection, course creation, annual planning, class scheduling, lesson preparation, reading material generation, teaching resources, billing, and plan upgrades into a single operational flow.

The project is not a static prototype. The current repository includes a working React/TypeScript application, Supabase backend structure, migrations, edge functions, AI-assisted curriculum and planning flows, billing logic, source handling, and validation mechanisms.

## Problem

Teachers often manage planning, curriculum documents, lesson schedules, bibliographies, classroom materials, and generated resources across disconnected tools.

DocencIA addresses that fragmentation by linking the course, annual plan, class agenda, teacher brief, confirmed bibliography, authorized sources, and generated materials within the same product and data structure.

## Current implemented scope

- Public landing and demo mode
- Supabase authentication with email/password and Google login
- Teacher dashboard with active and archived courses
- Curriculum import and resolution from official sources or PDFs
- 8-step course creation wizard
- AI-assisted annual plan bootstrap
- Structured annual plan editor and validation flow
- Class agenda and lesson sequencing
- Individual lesson preparation with teacher brief, bibliography, authorized sources, and AI copilot
- Didactic material and reading material generation
- PDF export for validated outputs
- Teacher-owned sources and guided premium source search
- Billing flows with Mercado Pago and manual payment requests

## AI / workflow relevance

This project includes AI-assisted operational flows rather than isolated prompting.

Relevant components include:

- curriculum resolution and parsing workflows;
- AI-assisted planning generation;
- structured prompt and output constraints;
- validation logic for generated educational outputs;
- source authorization and bibliography control;
- role-sensitive teacher workflows;
- edge functions for AI, curriculum, billing, premium sources, and QA support;
- explicit product canons and PRDs governing how AI should behave inside the platform.

## My contribution

I designed the product concept, functional architecture, AI-assisted workflow logic, pedagogical output rules, validation structure, product canons, PRDs, and implementation direction.

My work focused on transforming a complex educational and operational problem into a structured SaaS-oriented product with traceable workflows, contextual knowledge rules, AI-assisted generation, and validation mechanisms.

## Stack

Frontend: React 18, TypeScript, Vite, React Router  
UI: Tailwind CSS, shadcn/ui, Radix UI  
State/data: TanStack Query, Supabase JS  
Auth: Supabase Auth + Lovable Cloud Auth  
Backend: Supabase Postgres, Storage, Edge Functions  
AI: Lovable AI Gateway with Gemini models  
Payments: Mercado Pago  
Parsing/OCR: pdfjs-serverless, Mammoth, XLSX, AI OCR for images  
External search/source tooling: DuckDuckGo, YouTube, Wikipedia, Firecrawl, abc.gob.ar  
Tests: Vitest

## Product canon and PRDs

The repo includes explicit product behavior and AI-output governance documents:

- `docs/CANON_INDEX.md`
- `docs/CANON_OPERATIONAL.md`
- `docs/CANON_GOLDEN_FYHCT_6EESA.md`
- `docs/PRD_LOVABLE_ENV_BASE.md`
- `docs/PRD_LOVABLE_CORE_FLOW.md`

These files define how planning, class generation, reading material generation, AI behavior, platform dependencies, and rollout should be handled.

## Current state

The frontend includes public and private routes. The expected backend is modeled through Supabase migrations and generated types. Edge functions cover curriculum processing, AI workflows, billing, premium sources, and QA support. The repository also includes small but real automated tests for selection logic and PDF export behavior.

## Important note

This repository demonstrates the product structure, codebase, AI-assisted workflows, and architectural direction. Production secrets, deployment configuration, and cloud runtime state depend on the connected Supabase/Lovable environment and are not fully represented in the public repository.
