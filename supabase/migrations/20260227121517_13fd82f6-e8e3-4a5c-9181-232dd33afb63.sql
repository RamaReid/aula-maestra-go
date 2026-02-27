
-- 1A. Nuevos enums
CREATE TYPE public.brief_status AS ENUM ('IN_PROGRESS', 'READY_FOR_PRODUCTION', 'PRODUCED');
CREATE TYPE public.material_status AS ENUM ('GENERATED', 'VALIDATED', 'INVALIDATED');
CREATE TYPE public.depth_level AS ENUM ('BAJO', 'MEDIO', 'ALTO');

-- 1B. Nueva columna en lessons (control de concurrencia)
ALTER TABLE public.lessons ADD COLUMN is_generating BOOLEAN NOT NULL DEFAULT false;

-- 1C. Nuevas tablas

-- lesson_briefs (1:1 con lesson)
CREATE TABLE public.lesson_briefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  enfoque_deseado TEXT NOT NULL DEFAULT '',
  tipo_dinamica_sugerida TEXT NOT NULL DEFAULT '',
  nivel_profundidad public.depth_level NOT NULL DEFAULT 'MEDIO',
  observaciones_docente TEXT NOT NULL DEFAULT '',
  bibliografia_confirmada UUID[] NOT NULL DEFAULT '{}',
  status public.brief_status NOT NULL DEFAULT 'IN_PROGRESS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- teaching_materials (1:1 con lesson)
CREATE TABLE public.teaching_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL DEFAULT '',
  activities JSONB NOT NULL DEFAULT '[]',
  expected_product TEXT NOT NULL DEFAULT '',
  achievement_criteria TEXT[] NOT NULL DEFAULT '{}',
  differentiation JSONB NOT NULL DEFAULT '[]',
  closure TEXT NOT NULL DEFAULT '',
  status public.material_status NOT NULL DEFAULT 'GENERATED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- reading_materials (1:1 con lesson)
CREATE TABLE public.reading_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  word_count INTEGER NOT NULL DEFAULT 0,
  content_html TEXT NOT NULL DEFAULT '',
  pdf_url TEXT,
  status public.material_status NOT NULL DEFAULT 'GENERATED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1D. RLS Policies
ALTER TABLE public.lesson_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teaching_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage lesson briefs"
  ON public.lesson_briefs FOR ALL
  USING (is_lesson_owner(auth.uid(), lesson_id));

CREATE POLICY "Owners can manage teaching materials"
  ON public.teaching_materials FOR ALL
  USING (is_lesson_owner(auth.uid(), lesson_id));

CREATE POLICY "Owners can manage reading materials"
  ON public.reading_materials FOR ALL
  USING (is_lesson_owner(auth.uid(), lesson_id));

-- 1E. Ownership helper
CREATE OR REPLACE FUNCTION public.is_lesson_brief_owner(_user_id UUID, _brief_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lesson_briefs lb
    JOIN public.lessons l ON l.id = lb.lesson_id
    JOIN public.courses c ON c.id = l.course_id
    WHERE lb.id = _brief_id AND c.user_id = _user_id
  )
$$;

-- Updated_at triggers
CREATE TRIGGER update_lesson_briefs_updated_at
  BEFORE UPDATE ON public.lesson_briefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teaching_materials_updated_at
  BEFORE UPDATE ON public.teaching_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reading_materials_updated_at
  BEFORE UPDATE ON public.reading_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1F. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('reading-materials-pdf', 'reading-materials-pdf', true);

CREATE POLICY "Public read access for reading materials PDF"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reading-materials-pdf');

CREATE POLICY "Authenticated users can upload reading materials PDF"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reading-materials-pdf' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update reading materials PDF"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'reading-materials-pdf' AND auth.role() = 'authenticated');
