
CREATE TABLE public.plan_rubric_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  unit_label text NOT NULL DEFAULT '',
  criteria text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_rubric_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage rubric items" ON public.plan_rubric_items
  FOR ALL USING (public.is_plan_owner(auth.uid(), plan_id))
  WITH CHECK (public.is_plan_owner(auth.uid(), plan_id));
