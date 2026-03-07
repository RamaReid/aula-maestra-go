CREATE TABLE public.premium_query_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  raw_query TEXT NOT NULL CHECK (char_length(trim(raw_query)) > 0),
  normalized_query TEXT NOT NULL DEFAULT '',
  corrected_query TEXT,
  requested_resource_type TEXT,
  target_entity TEXT,
  target_topic TEXT,
  context_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'RESOLVED', 'REJECTED', 'FAILED', 'APPROVED')
  ),
  rejection_reason TEXT,
  resolved_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_candidate JSONB,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX premium_query_requests_course_idx ON public.premium_query_requests(course_id);
CREATE INDEX premium_query_requests_status_idx ON public.premium_query_requests(status);
CREATE INDEX premium_query_requests_created_by_idx ON public.premium_query_requests(created_by);

CREATE OR REPLACE FUNCTION public.is_premium_query_owner(_user_id UUID, _request_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.premium_query_requests q
    JOIN public.courses c ON c.id = q.course_id
    WHERE q.id = _request_id
      AND c.user_id = _user_id
  )
$$;

ALTER TABLE public.premium_query_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view premium query requests"
  ON public.premium_query_requests FOR SELECT TO authenticated
  USING (public.is_course_owner(auth.uid(), course_id));

CREATE POLICY "Owners can create premium query requests"
  ON public.premium_query_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_course_owner(auth.uid(), course_id) AND created_by = auth.uid());

CREATE POLICY "Owners can update premium query requests"
  ON public.premium_query_requests FOR UPDATE TO authenticated
  USING (public.is_course_owner(auth.uid(), course_id))
  WITH CHECK (public.is_course_owner(auth.uid(), course_id));

CREATE POLICY "Owners can delete premium query requests"
  ON public.premium_query_requests FOR DELETE TO authenticated
  USING (public.is_course_owner(auth.uid(), course_id));

CREATE TRIGGER update_premium_query_requests_updated_at
  BEFORE UPDATE ON public.premium_query_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();