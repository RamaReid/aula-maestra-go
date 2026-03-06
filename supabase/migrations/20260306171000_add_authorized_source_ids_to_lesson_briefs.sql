ALTER TABLE public.lesson_briefs
  ADD COLUMN authorized_source_ids UUID[] NOT NULL DEFAULT '{}';
