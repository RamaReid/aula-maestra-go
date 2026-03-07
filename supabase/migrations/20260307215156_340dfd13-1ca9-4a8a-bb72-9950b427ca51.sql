CREATE TABLE public.authorized_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  origin_type TEXT NOT NULL CHECK (
    origin_type IN (
      'CURRICULAR',
      'DOCENTE_ARCHIVO',
      'DOCENTE_URL',
      'DOCENTE_VIDEO',
      'BUSQUEDA_PREMIUM'
    )
  ),
  plan_scope public.plan_type NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('PDF', 'IMAGE', 'URL', 'VIDEO', 'TEXT', 'DOC', 'SHEET')),
  title TEXT NOT NULL DEFAULT '' CHECK (char_length(trim(title)) > 0),
  author_label TEXT,
  source_url TEXT,
  storage_path TEXT,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'APPROVED', 'REJECTED')
  ),
  processing_error TEXT,
  extracted_text TEXT,
  summary_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX authorized_sources_course_idx ON public.authorized_sources(course_id);
CREATE INDEX authorized_sources_status_idx ON public.authorized_sources(status);
CREATE INDEX authorized_sources_origin_idx ON public.authorized_sources(origin_type);

CREATE TABLE public.authorized_source_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.authorized_sources(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('LESSON', 'SEQUENCE')),
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  sequence_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT authorized_source_targets_scope_chk CHECK (
    (target_type = 'LESSON' AND lesson_id IS NOT NULL AND sequence_key IS NULL)
    OR (target_type = 'SEQUENCE' AND lesson_id IS NULL AND char_length(trim(coalesce(sequence_key, ''))) > 0)
  )
);

CREATE INDEX authorized_source_targets_source_idx ON public.authorized_source_targets(source_id);
CREATE INDEX authorized_source_targets_lesson_idx ON public.authorized_source_targets(lesson_id);
CREATE INDEX authorized_source_targets_sequence_idx ON public.authorized_source_targets(sequence_key);

CREATE OR REPLACE FUNCTION public.is_authorized_source_owner(_user_id UUID, _source_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.authorized_sources s
    JOIN public.courses c ON c.id = s.course_id
    WHERE s.id = _source_id
      AND c.user_id = _user_id
  )
$$;

ALTER TABLE public.authorized_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorized_source_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view authorized sources"
  ON public.authorized_sources FOR SELECT TO authenticated
  USING (public.is_course_owner(auth.uid(), course_id));

CREATE POLICY "Owners can create authorized sources"
  ON public.authorized_sources FOR INSERT TO authenticated
  WITH CHECK (public.is_course_owner(auth.uid(), course_id) AND created_by = auth.uid());

CREATE POLICY "Owners can update authorized sources"
  ON public.authorized_sources FOR UPDATE TO authenticated
  USING (public.is_course_owner(auth.uid(), course_id))
  WITH CHECK (public.is_course_owner(auth.uid(), course_id));

CREATE POLICY "Owners can delete authorized sources"
  ON public.authorized_sources FOR DELETE TO authenticated
  USING (public.is_course_owner(auth.uid(), course_id));

CREATE POLICY "Owners can manage authorized source targets"
  ON public.authorized_source_targets FOR ALL TO authenticated
  USING (public.is_authorized_source_owner(auth.uid(), source_id))
  WITH CHECK (public.is_authorized_source_owner(auth.uid(), source_id));

CREATE TRIGGER update_authorized_sources_updated_at
  BEFORE UPDATE ON public.authorized_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();