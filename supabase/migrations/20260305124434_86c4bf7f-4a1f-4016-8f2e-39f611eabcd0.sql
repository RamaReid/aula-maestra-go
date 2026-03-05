
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS curriculum_document_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'courses_curriculum_document_id_fkey'
      AND conrelid = 'public.courses'::regclass
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_curriculum_document_id_fkey
      FOREIGN KEY (curriculum_document_id)
      REFERENCES public.curriculum_documents(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS courses_curriculum_document_id_idx
  ON public.courses(curriculum_document_id);
