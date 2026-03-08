
-- 1. course_schedule_slots table
CREATE TABLE public.course_schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  module_count integer NOT NULL DEFAULT 1,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage course schedule slots"
  ON public.course_schedule_slots FOR ALL
  TO authenticated
  USING (is_course_owner(auth.uid(), course_id))
  WITH CHECK (is_course_owner(auth.uid(), course_id));

-- 2. Add content_block_id to plan_lessons
ALTER TABLE public.plan_lessons
  ADD COLUMN IF NOT EXISTS content_block_id uuid REFERENCES public.plan_content_blocks(id) ON DELETE SET NULL;
