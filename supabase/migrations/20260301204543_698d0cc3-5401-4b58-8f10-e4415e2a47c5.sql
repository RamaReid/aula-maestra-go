
ALTER TABLE public.plans ADD COLUMN resources text NOT NULL DEFAULT '';
ALTER TABLE public.plan_lessons ADD COLUMN activities_summary text NOT NULL DEFAULT '';
