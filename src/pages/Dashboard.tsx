import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { clearMockCurriculumForCourse } from "@/mock/curriculumCatalog";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/editorial/PageIntro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LogOut, Plus, ChevronDown, BookOpen, Upload, Trash2, Archive, MoreVertical, CreditCard, RefreshCw, Pencil } from "lucide-react";
import { PlanType, useEntitlements } from "@/hooks/useEntitlements";
import { PlanSwitcher } from "@/components/PlanSwitcher";
import { StatusBadge, planTone, planLabel } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/SkeletonList";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EditCourseDialog } from "@/components/EditCourseDialog";
import type { Tables } from "@/integrations/supabase/types";
import { formatErrorMessage } from "@/lib/errors";
import GuidedTour from "@/components/GuidedTour";
import type { TourStep } from "@/hooks/useTour";

const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    id: "new-course",
    targetSelector: '[data-tour="dashboard-new-course"]',
    title: "Crear un curso",
    description: "Creá un nuevo curso desde acá. Es el primer paso para empezar a planificar.",
  },
  {
    id: "courses",
    targetSelector: '[data-tour="dashboard-courses"]',
    title: "Tus cursos",
    description: "Cada tarjeta muestra un curso con su estado. Hacé clic en 'Abrir curso' para entrar.",
  },
  {
    id: "sync-abc",
    targetSelector: '[data-tour="dashboard-sync-abc"]',
    title: "Sincronizar diseño curricular",
    description: "Importá el diseño curricular oficial de tu provincia para que el sistema lo use como referencia.",
  },
];

interface CourseWithDetails {
  id: string;
  subject: string;
  year_level: number;
  academic_year: number;
  status: string;
  school_id: string;
  school: { official_name: string } | null;
  plan: { status: string } | null;
}

type CourseQueryRow = Pick<Tables<"courses">, "id" | "subject" | "year_level" | "academic_year" | "status" | "school_id"> & {
  schools: Pick<Tables<"schools">, "official_name"> | null;
  plans: { status: string } | null;
};

const QA_EMAILS = new Set(["rgarciareid@gmail.com", "bigschool@test.docencia.ai"]);

export default function Dashboard() {
  const { profile, logout } = useAuth();
  const {
    planType,
    entitlements,
    loading: entitlementsLoading,
    error: entitlementsError,
    refetch: refetchEntitlements,
  } = useEntitlements();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseWithDetails[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<CourseWithDetails | null>(null);
  const [courseToArchive, setCourseToArchive] = useState<CourseWithDetails | null>(null);
  const [courseToEdit, setCourseToEdit] = useState<CourseWithDetails | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [archivingCourseId, setArchivingCourseId] = useState<string | null>(null);
  const [switchingPlan, setSwitchingPlan] = useState(false);

  const fetchCourses = useCallback(async () => {
    setCoursesError(null);

    try {
      const { data, error } = await supabase
        .from("courses")
        .select("id, subject, year_level, academic_year, status, school_id, schools(official_name), plans(status)")
        .order("academic_year", { ascending: false });

      if (error) throw error;

      setCourses(
        ((data || []) as unknown as CourseQueryRow[]).map((c) => ({
          id: c.id,
          subject: c.subject,
          year_level: c.year_level,
          academic_year: c.academic_year,
          status: c.status,
          school_id: c.school_id,
          school: c.schools ? { official_name: c.schools.official_name } : null,
          plan: c.plans ? { status: c.plans.status } : null,
        }))
      );
    } catch (error) {
      setCoursesError(formatErrorMessage(error, "No se pudieron cargar tus cursos."));
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleNewCourse = () => {
    navigate("/course/new");
  };

  const handleArchiveCourse = async () => {
    if (!courseToArchive) return;

    setArchivingCourseId(courseToArchive.id);
    try {
      const { error } = await supabase
        .from("courses")
        .update({ status: "ARCHIVED" })
        .eq("id", courseToArchive.id);
      if (error) throw error;

      setCourseToArchive(null);
      await fetchCourses();
      toast({
        title: "Curso archivado",
        description: "El curso se movio a la seccion de cursos archivados.",
      });
    } catch (error) {
      toast({
        title: "No se pudo archivar el curso",
        description: formatErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setArchivingCourseId(null);
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;

    setDeletingCourseId(courseToDelete.id);
    try {
      const { error } = await supabase.from("courses").delete().eq("id", courseToDelete.id);
      if (error) throw error;

      clearMockCurriculumForCourse(courseToDelete.id);
      setCourseToDelete(null);
      await fetchCourses();
      toast({
        title: "Curso eliminado",
        description: "Se eliminaron tambien el plan, las clases y los materiales asociados.",
      });
    } catch (error) {
      toast({
        title: "No se pudo eliminar el curso",
        description: formatErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setDeletingCourseId(null);
    }
  };

  const activeCourses = courses.filter((c) => c.status === "ACTIVE");
  const archivedCourses = courses.filter((c) => c.status === "ARCHIVED");
  const primaryFreeCourse = activeCourses[0] || null;
  const isQaUser = QA_EMAILS.has((profile?.email || "").toLowerCase());
  const canRenderEntitlements = planType !== null && entitlements !== null;

  const handlePlanSwitch = async (nextPlan: PlanType) => {
    if (!isQaUser || !planType || nextPlan === planType) return;

    setSwitchingPlan(true);
    try {
      const { data, error } = await supabase.functions.invoke("set-test-plan", {
        body: { plan_type: nextPlan },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await refetchEntitlements();
      toast({
        title: "Plan de prueba actualizado",
        description: `Ahora estas viendo el plan ${nextPlan}.`,
      });
    } catch (error) {
      toast({
        title: "No se pudo cambiar el plan de prueba",
        description: formatErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSwitchingPlan(false);
    }
  };

  if (!canRenderEntitlements && !entitlementsError) {
    return (
      <LoadingState
        variant="page"
        tips={[
          "Verificando tu plan...",
          "Cargando permisos de tu cuenta...",
          "Ya casi estamos...",
        ]}
      />
    );
  }

  if (!canRenderEntitlements && entitlementsError) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4 py-8">
          <Card className="w-full max-w-xl">
            <CardContent className="flex flex-col items-center gap-5 py-14 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">No se pudo cargar tu plan</h2>
                <p className="text-sm text-muted-foreground">{entitlementsError}</p>
              </div>
              <Button size="lg" onClick={() => refetchEntitlements()}>
                Reintentar
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!planType || !entitlements) {
    return null;
  }

  if (planType === "FREE") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="mx-auto grid max-w-4xl grid-cols-3 items-center px-4 py-4">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-foreground">
                {profile?.name || "Docente"}
              </h1>
              <p className="truncate text-sm text-muted-foreground">{profile?.email}</p>
            </div>

            <div className="flex justify-center">
              <PlanSwitcher planType={planType} isQaUser={isQaUser} switchingPlan={switchingPlan} onPlanSwitch={handlePlanSwitch} />
            </div>

            <div className="flex justify-end">
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/billing">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Facturacion
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Salir
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-4xl items-center justify-center px-4 py-8">
          <Card className="w-full max-w-xl">
            <CardContent className="flex flex-col items-center gap-5 py-14 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
              {coursesLoading || entitlementsLoading ? (
                <div className="w-full">
                  <SkeletonList count={1} />
                </div>
              ) : coursesError ? (
                <>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold text-foreground">No se pudieron cargar tus cursos</h2>
                    <p className="text-sm text-muted-foreground">{coursesError}</p>
                  </div>
                  <Button size="lg" onClick={fetchCourses}>
                    Reintentar
                  </Button>
                </>
              ) : primaryFreeCourse ? (
                <>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold text-foreground">Tu curso de muestra ya está listo</h2>
                    <p className="text-sm leading-7 text-muted-foreground">
                      Podés abrir tu curso y seguir con la generación de hasta {entitlements.max_classes_per_session} clases por sesión.
                    </p>
                  </div>
                  <Button asChild size="lg">
                    <Link to={`/course/${primaryFreeCourse.id}`}>Abrir curso</Link>
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold text-foreground">Creá tu primer curso para empezar a planificar</h2>
                    <p className="text-sm text-muted-foreground">
                      El plan Free te permite probar 1 curso y generar hasta {entitlements.max_classes_per_session} clases por sesión, con un máximo de {entitlements.max_weekly_sessions} sesiones por semana.
                    </p>
                  </div>
                  <Button size="lg" onClick={handleNewCourse}>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear curso
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Hola, {profile?.name || "Docente"}
              </h1>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          <PlanSwitcher planType={planType} isQaUser={isQaUser} switchingPlan={switchingPlan} onPlanSwitch={handlePlanSwitch} />
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                Facturacion
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <PageIntro
          eyebrow="Panel docente"
          title="Cursos, agenda y acceso rapido al trabajo del dia"
          description="Organiza el recorrido anual de cada curso, revisa estados de planificacion y entra rapido a las clases o a la sincronizacion curricular."
        />
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Mis cursos activos</h2>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" data-tour="dashboard-sync-abc">
                <Link to="/curriculum/import">
                  <Upload className="mr-2 h-4 w-4" />
                  Sincronizar ABC
                </Link>
              </Button>
              <Button size="sm" onClick={handleNewCourse} data-tour="dashboard-new-course">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo curso
              </Button>
            </div>
          </div>
          {coursesLoading ? (
            <SkeletonList count={4} />
          ) : coursesError ? (
            <EmptyState
              icon={BookOpen}
              title="No se pudieron cargar los cursos"
              description={coursesError}
              action={{ label: "Reintentar", onClick: fetchCourses }}
            />
          ) : activeCourses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No tenes cursos activos"
              description="Crea tu primer curso para empezar a planificar."
              action={{ label: "Crear primer curso", onClick: () => navigate("/course/new") }}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2" data-tour="dashboard-courses">
              {activeCourses.map((course) => (
                <Card key={course.id} className="flex flex-col rounded-[1.5rem] border-border/80 bg-card/90 transition-colors hover:border-primary/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Curso</p>
                        <CardTitle className="text-xl font-semibold tracking-tight">{course.subject}</CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Acciones</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setCourseToEdit(course)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar curso
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/curriculum/import?course_id=${course.id}`)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Recargar diseño curricular
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCourseToArchive(course)}>
                            <Archive className="mr-2 h-4 w-4" />
                            Archivar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setCourseToDelete(course)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="mt-auto space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {course.school?.official_name ?? "Sin escuela"} · {course.year_level}° año · {course.academic_year}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <StatusBadge tone={planTone(course.plan?.status)} label={planLabel(course.plan?.status)} />
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/course/${course.id}`}>Abrir curso</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {archivedCourses.length > 0 && (
          <>
            <Separator />
            <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  Cursos archivados ({archivedCourses.length})
                  <ChevronDown className={`h-4 w-4 transition-transform ${archivedOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {archivedCourses.map((course) => (
                    <Card key={course.id} className="rounded-[1.5rem] border-border/80 bg-card/80 opacity-70">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle className="text-lg font-semibold tracking-tight">{course.subject}</CardTitle>
                          <StatusBadge tone="archived" label="Archivado" />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm leading-7 text-muted-foreground">
                          {course.school?.official_name ?? "Sin escuela"} · {course.year_level}° año · {course.academic_year}
                        </p>
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/course/${course.id}`}>Abrir curso</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </main>

      <AlertDialog open={!!courseToArchive} onOpenChange={(open) => !open && setCourseToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar curso</AlertDialogTitle>
            <AlertDialogDescription>
              {courseToArchive
                ? `Vas a archivar ${courseToArchive.subject} de ${courseToArchive.year_level}° año. El curso dejara de figurar entre los activos y pasara a la seccion de archivados.`
                : "El curso se movera a la seccion de archivados."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!archivingCourseId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={!!archivingCourseId} onClick={handleArchiveCourse}>
              {archivingCourseId ? "Archivando..." : "Archivar curso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!courseToDelete} onOpenChange={(open) => !open && setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar curso</AlertDialogTitle>
            <AlertDialogDescription>
              {courseToDelete
                ? `Vas a eliminar ${courseToDelete.subject} de ${courseToDelete.year_level}° año. Esta accion borra tambien el plan, las clases y los materiales asociados.`
                : "Esta accion no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingCourseId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deletingCourseId}
              onClick={handleDeleteCourse}
            >
              {deletingCourseId ? "Eliminando..." : "Eliminar curso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditCourseDialog
        course={courseToEdit}
        open={!!courseToEdit}
        onOpenChange={(open) => !open && setCourseToEdit(null)}
        onSaved={fetchCourses}
      />

      {!coursesLoading && activeCourses.length > 0 && <GuidedTour steps={DASHBOARD_TOUR_STEPS} />}
    </div>
  );
}
