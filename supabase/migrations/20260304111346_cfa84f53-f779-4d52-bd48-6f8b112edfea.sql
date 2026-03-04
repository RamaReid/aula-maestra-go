ALTER TABLE public.curriculum_documents
  ADD COLUMN IF NOT EXISTS source_provider text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS school_type text,
  ADD COLUMN IF NOT EXISTS orientation text,
  ADD COLUMN IF NOT EXISTS speciality text,
  ADD COLUMN IF NOT EXISTS official_title text,
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz;