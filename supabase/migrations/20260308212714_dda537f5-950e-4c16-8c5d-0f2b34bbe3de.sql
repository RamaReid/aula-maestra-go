
-- 1. plan_content_blocks
CREATE TABLE public.plan_content_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  topics text[] NOT NULL DEFAULT '{}'::text[],
  term integer,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_content_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage plan content blocks"
  ON public.plan_content_blocks FOR ALL
  TO authenticated
  USING (is_plan_owner(auth.uid(), plan_id))
  WITH CHECK (is_plan_owner(auth.uid(), plan_id));

-- 2. plan_rubrics
CREATE TABLE public.plan_rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  content_block_id uuid REFERENCES public.plan_content_blocks(id) ON DELETE SET NULL,
  criterion_name text NOT NULL DEFAULT '',
  focus_note text NOT NULL DEFAULT '',
  advanced_level text NOT NULL DEFAULT '',
  expected_level text NOT NULL DEFAULT '',
  basic_level text NOT NULL DEFAULT '',
  initial_level text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage plan rubrics"
  ON public.plan_rubrics FOR ALL
  TO authenticated
  USING (is_plan_owner(auth.uid(), plan_id))
  WITH CHECK (is_plan_owner(auth.uid(), plan_id));

-- 3. plan_teacher_bibliography_entries
CREATE TABLE public.plan_teacher_bibliography_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  citation text NOT NULL DEFAULT '',
  usage_notes text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_teacher_bibliography_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage teacher bibliography"
  ON public.plan_teacher_bibliography_entries FOR ALL
  TO authenticated
  USING (is_plan_owner(auth.uid(), plan_id))
  WITH CHECK (is_plan_owner(auth.uid(), plan_id));
