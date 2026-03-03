import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { clearMockCurriculumForCourse } from "@/mock/curriculumCatalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LogOut, Plus, ChevronDown, BookOpen, Upload, Trash2, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PlanType, useEntitlements } from "@/hooks/useEntitlements";
import { StatusBadge, planTone, planLabel } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/SkeletonList";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CourseWithDetails {
  id: string;
  subject: string;
  year_level: number;
  academic_year: number;
  status: string;
  school: { official_name: string } | null;
  plan: { status: string } | null;
}

const planBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  FREE: "outline",
  BASICO: "secondary",
  PREMIUM: "default",
};
const QA_EMAIL = "rgarciareid@gmail.com";

export default function Dashboard() {
  const { profile, logout } = useAuth();
  const { planType, entitlements, refetch: refetchEntitlements } = useEntitlements();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<CourseWithDetails | null>(null);
  const [courseToArchive, setCourseToArchive] = useState<CourseWithDetails | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [archivingCourseId, setArchivingCourseId] = useState<string | null>(null);
  const [switchingPlan, setSwitchingPlan] = useState(false);

  const fetchCourses = useCallback(async () => {
    const { data } = await supabase
      .from("courses")
      .select("id, subject, year_level, academic_year, status, schools(official_name), plans(status)")
      .order("academic_year", { ascending: false });

    if (data) {
      setCourses(
        data.map((c: any) => ({
          id: c.id,
          subject: c.subject,
          year_level: c.year_level,
          academic_year: c.academic_year,
          status: c.status,
          school: c.schools ? { official_name: c.schools.official_name } : null,
          plan: c.plans ? { status: c.plans.status } : null,
        }))
      );
    }
    setLoading(false);
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
        description: error instanceof Error ? error.message : "Error desconocido",
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
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setDeletingCourseId(null);
    }
  };

  const activeCourses = courses.filter((c) => c.status === "ACTIVE");
  const archivedCourses = courses.filter((c) => c.status === "ARCHIVED");
  const primaryFreeCourse = activeCourses[0] || null;
  const isQaUser = (profile?.email || "").toLowerCase() === QA_EMAIL;

  const handlePlanSwitch = async (nextPlan: PlanType) => {
    if (!isQaUser || nextPlan === planType) return;

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
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setSwitchingPlan(false);
    }
  };

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
              {isQaUser ? (
                <div className="w-full max-w-[180px]">
                  <Select value={planType} onValueChange={(value) => handlePlanSwitch(value as PlanType)} disabled={switchingPlan}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FREE">FREE</SelectItem>
                      <SelectItem value="BASICO">BASICO</SelectItem>
                      <SelectItem value="PREMIUM">PREMIUM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <Badge variant={planBadgeVariant[planType] || "outline"} className="text-xs">
                  {planType}
                </Badge>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                Salir
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-4xl items-center justify-center px-4 py-8">
          <Card className="w-full max-w-xl">
            <CardContent className="flex flex-col items-center gap-5 py-14 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
              {loading ? (
                <div className="w-full">
                  <SkeletonList count={1} />
                </div>
              ) : primaryFreeCourse ? (
                <>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold text-foreground">Tu curso de muestra ya está listo</h2>
                    <p className="text-sm text-muted-foreground">
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
            {isQaUser ? (
              <div className="w-[180px]">
                <Select value={planType} onValueChange={(value) => handlePlanSwitch(value as PlanType)} disabled={switchingPlan}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">FREE</SelectItem>
                    <SelectItem value="BASICO">BASICO</SelectItem>
                    <SelectItem value="PREMIUM">PREMIUM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Badge variant={planBadgeVariant[planType] || "outline"} className="text-xs">
                {planType}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Mis cursos activos</h2>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/curriculum/import">
                  <Upload className="mr-2 h-4 w-4" />
                  Importar programa
                </Link>
              </Button>
              <Button size="sm" onClick={handleNewCourse}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo curso
              </Button>
            </div>
          </div>

          {loading ? (
            <SkeletonList count={4} />
          ) : activeCourses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No tenes cursos activos"
              description="Crea tu primer curso para empezar a planificar."
              action={{ label: "Crear primer curso", onClick: () => navigate("/course/new") }}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {activeCourses.map((course) => (
                <Card key={course.id} className="transition-colors hover:border-primary/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-base">{course.subject}</CardTitle>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Archivar ${course.subject}`}
                          onClick={() => setCourseToArchive(course)}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archivar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          aria-label={`Eliminar ${course.subject}`}
                          onClick={() => setCourseToDelete(course)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
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
                    <Card key={course.id} className="opacity-70">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle className="text-base">{course.subject}</CardTitle>
                          <StatusBadge tone="archived" label="Archivado" />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
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
    </div>
  );
}
