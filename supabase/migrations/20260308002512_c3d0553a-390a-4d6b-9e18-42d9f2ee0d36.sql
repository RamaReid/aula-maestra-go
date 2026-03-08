CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid,
  lesson_id uuid,
  request_id text,
  feature text NOT NULL,
  model text NOT NULL,
  prompt_tokens int DEFAULT 0,
  completion_tokens int DEFAULT 0,
  total_tokens int DEFAULT 0,
  estimated boolean DEFAULT false,
  duration_ms int,
  cost_usd numeric(10,6),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai usage"
  ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());