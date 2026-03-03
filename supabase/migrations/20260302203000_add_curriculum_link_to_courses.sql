ALTER TABLE public.courses
ADD COLUMN curriculum_document_id UUID REFERENCES public.curriculum_documents(id) ON DELETE SET NULL;

CREATE INDEX courses_curriculum_document_id_idx
  ON public.courses(curriculum_document_id);

ALTER TABLE public.curriculum_documents
ADD COLUMN official_title TEXT,
ADD COLUMN source_provider TEXT NOT NULL DEFAULT 'ABC_PBA',
ADD COLUMN fetched_at TIMESTAMPTZ,
ADD COLUMN raw_text TEXT NOT NULL DEFAULT '',
ADD COLUMN school_type public.school_type,
ADD COLUMN orientation TEXT,
ADD COLUMN speciality TEXT;

CREATE INDEX curriculum_documents_resolver_idx
  ON public.curriculum_documents(province, subject, cycle, year_level);
