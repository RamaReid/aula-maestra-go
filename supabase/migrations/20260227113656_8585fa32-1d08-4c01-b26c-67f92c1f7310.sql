
-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE public.app_role AS ENUM ('docente', 'admin');
CREATE TYPE public.school_type AS ENUM ('COMUN', 'TECNICA');
CREATE TYPE public.curriculum_cycle AS ENUM ('BASIC', 'UPPER');
CREATE TYPE public.curriculum_status AS ENUM ('VERIFIED', 'DEPRECATED');
CREATE TYPE public.curriculum_node_type AS ENUM ('EJE', 'UNIDAD', 'BLOQUE', 'CONTENIDO');
CREATE TYPE public.course_status AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE public.plan_status AS ENUM ('INCOMPLETE', 'VALIDATED');
CREATE TYPE public.lesson_status AS ENUM ('PLANNED', 'TAUGHT', 'RESCHEDULED', 'LOCKED');

-- ============================================
-- 1. PROFILES
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, '')
  );
  -- Auto-assign docente role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'docente');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. USER_ROLES
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================
-- 3. SCHOOLS
-- ============================================
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  official_name TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT '',
  locality TEXT NOT NULL DEFAULT '',
  school_type school_type NOT NULL DEFAULT 'COMUN',
  source_url TEXT,
  user_created BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. CURRICULUM_DOCUMENTS
-- ============================================
CREATE TABLE public.curriculum_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  province TEXT NOT NULL DEFAULT 'PBA',
  subject TEXT NOT NULL,
  cycle curriculum_cycle NOT NULL,
  year_level INT NOT NULL CHECK (year_level BETWEEN 1 AND 6),
  status curriculum_status NOT NULL DEFAULT 'VERIFIED',
  content_hash TEXT,
  official_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.curriculum_documents ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. CURRICULUM_NODES
-- ============================================
CREATE TABLE public.curriculum_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_document_id UUID NOT NULL REFERENCES public.curriculum_documents(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
  node_type curriculum_node_type NOT NULL,
  name TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.curriculum_nodes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. COURSES
-- ============================================
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  subject TEXT NOT NULL,
  year_level INT NOT NULL CHECK (year_level BETWEEN 1 AND 6),
  academic_year INT NOT NULL,
  status course_status NOT NULL DEFAULT 'ACTIVE',
  orientation TEXT,
  speciality TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id, subject, year_level, academic_year)
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. PLANS
-- ============================================
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL UNIQUE REFERENCES public.courses(id) ON DELETE CASCADE,
  status plan_status NOT NULL DEFAULT 'INCOMPLETE',
  fundamentacion TEXT NOT NULL DEFAULT '',
  estrategias_marco TEXT NOT NULL DEFAULT '',
  estrategias_practicas TEXT[] NOT NULL DEFAULT '{}',
  evaluacion_marco TEXT NOT NULL DEFAULT '',
  second_term_started BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. PLAN_OBJECTIVES
-- ============================================
CREATE TABLE public.plan_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plan_objectives ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 9. PLAN_CONTENT_MAPPINGS
-- ============================================
CREATE TABLE public.plan_content_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  curriculum_node_id UUID NOT NULL REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, curriculum_node_id)
);
ALTER TABLE public.plan_content_mappings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 10. PLAN_LESSONS
-- ============================================
CREATE TABLE public.plan_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  lesson_number INT NOT NULL CHECK (lesson_number BETWEEN 1 AND 28),
  term INT NOT NULL CHECK (term IN (1, 2)),
  theme TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  justification TEXT NOT NULL DEFAULT '',
  learning_outcome TEXT NOT NULL DEFAULT '',
  is_integrative_evaluation BOOLEAN NOT NULL DEFAULT false,
  is_recovery BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, lesson_number)
);
ALTER TABLE public.plan_lessons ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 11. PLAN_LESSON_CONTENT_LINKS
-- ============================================
CREATE TABLE public.plan_lesson_content_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_lesson_id UUID NOT NULL REFERENCES public.plan_lessons(id) ON DELETE CASCADE,
  plan_content_mapping_id UUID NOT NULL REFERENCES public.plan_content_mappings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_lesson_id, plan_content_mapping_id)
);
ALTER TABLE public.plan_lesson_content_links ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 12. LESSONS
-- ============================================
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  plan_lesson_id UUID NOT NULL REFERENCES public.plan_lessons(id) ON DELETE CASCADE,
  lesson_number INT NOT NULL CHECK (lesson_number BETWEEN 1 AND 28),
  scheduled_date DATE,
  status lesson_status NOT NULL DEFAULT 'PLANNED',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, lesson_number)
);
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 13. LESSON_SHIFT_EVENTS
-- ============================================
CREATE TABLE public.lesson_shift_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  previous_date DATE,
  new_date DATE,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lesson_shift_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS (ownership checks via security definer)
-- ============================================

-- Check course ownership
CREATE OR REPLACE FUNCTION public.is_course_owner(_user_id UUID, _course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses
    WHERE id = _course_id AND user_id = _user_id
  )
$$;

-- Check plan ownership (via course)
CREATE OR REPLACE FUNCTION public.is_plan_owner(_user_id UUID, _plan_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plans p
    JOIN public.courses c ON c.id = p.course_id
    WHERE p.id = _plan_id AND c.user_id = _user_id
  )
$$;

-- Check plan_lesson ownership (via plan → course)
CREATE OR REPLACE FUNCTION public.is_plan_lesson_owner(_user_id UUID, _plan_lesson_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plan_lessons pl
    JOIN public.plans p ON p.id = pl.plan_id
    JOIN public.courses c ON c.id = p.course_id
    WHERE pl.id = _plan_lesson_id AND c.user_id = _user_id
  )
$$;

-- Check lesson ownership (via course)
CREATE OR REPLACE FUNCTION public.is_lesson_owner(_user_id UUID, _lesson_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.courses c ON c.id = l.course_id
    WHERE l.id = _lesson_id AND c.user_id = _user_id
  )
$$;

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_curriculum_documents_updated_at BEFORE UPDATE ON public.curriculum_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_curriculum_nodes_updated_at BEFORE UPDATE ON public.curriculum_nodes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plan_lessons_updated_at BEFORE UPDATE ON public.plan_lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- USER_ROLES
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- SCHOOLS
CREATE POLICY "Anyone authenticated can view schools" ON public.schools FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own schools" ON public.schools FOR INSERT TO authenticated WITH CHECK (user_created = true AND created_by = auth.uid());
CREATE POLICY "Users can update own schools" ON public.schools FOR UPDATE TO authenticated USING (user_created = true AND created_by = auth.uid());
CREATE POLICY "Users can delete own schools" ON public.schools FOR DELETE TO authenticated USING (user_created = true AND created_by = auth.uid());
CREATE POLICY "Admins can manage all schools" ON public.schools FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- CURRICULUM_DOCUMENTS
CREATE POLICY "Authenticated can view curriculum docs" ON public.curriculum_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage curriculum docs" ON public.curriculum_documents FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- CURRICULUM_NODES
CREATE POLICY "Authenticated can view curriculum nodes" ON public.curriculum_nodes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage curriculum nodes" ON public.curriculum_nodes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- COURSES
CREATE POLICY "Users can view own courses" ON public.courses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create own courses" ON public.courses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own courses" ON public.courses FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own courses" ON public.courses FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all courses" ON public.courses FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- PLANS
CREATE POLICY "Owners can view plans" ON public.plans FOR SELECT TO authenticated USING (public.is_course_owner(auth.uid(), course_id));
CREATE POLICY "Owners can create plans" ON public.plans FOR INSERT TO authenticated WITH CHECK (public.is_course_owner(auth.uid(), course_id));
CREATE POLICY "Owners can update plans" ON public.plans FOR UPDATE TO authenticated USING (public.is_course_owner(auth.uid(), course_id));
CREATE POLICY "Owners can delete plans" ON public.plans FOR DELETE TO authenticated USING (public.is_course_owner(auth.uid(), course_id));

-- PLAN_OBJECTIVES
CREATE POLICY "Owners can manage plan objectives" ON public.plan_objectives FOR ALL TO authenticated USING (public.is_plan_owner(auth.uid(), plan_id));

-- PLAN_CONTENT_MAPPINGS
CREATE POLICY "Owners can manage content mappings" ON public.plan_content_mappings FOR ALL TO authenticated USING (public.is_plan_owner(auth.uid(), plan_id));

-- PLAN_LESSONS
CREATE POLICY "Owners can manage plan lessons" ON public.plan_lessons FOR ALL TO authenticated USING (public.is_plan_owner(auth.uid(), plan_id));

-- PLAN_LESSON_CONTENT_LINKS
CREATE POLICY "Owners can manage lesson content links" ON public.plan_lesson_content_links FOR ALL TO authenticated USING (public.is_plan_lesson_owner(auth.uid(), plan_lesson_id));

-- LESSONS
CREATE POLICY "Owners can view lessons" ON public.lessons FOR SELECT TO authenticated USING (public.is_course_owner(auth.uid(), course_id));
CREATE POLICY "Owners can create lessons" ON public.lessons FOR INSERT TO authenticated WITH CHECK (public.is_course_owner(auth.uid(), course_id));
CREATE POLICY "Owners can update lessons" ON public.lessons FOR UPDATE TO authenticated USING (public.is_course_owner(auth.uid(), course_id));
CREATE POLICY "Owners can delete lessons" ON public.lessons FOR DELETE TO authenticated USING (public.is_course_owner(auth.uid(), course_id));

-- LESSON_SHIFT_EVENTS
CREATE POLICY "Owners can manage shift events" ON public.lesson_shift_events FOR ALL TO authenticated USING (public.is_lesson_owner(auth.uid(), lesson_id));
