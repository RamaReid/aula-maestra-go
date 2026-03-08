import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Archive, ArrowLeft, BookOpen, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PageIntro } from "@/components/editorial/PageIntro";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import PlanEditor from "@/components/plan/PlanEditor";
import AgendaView from "@/components/plan/AgendaView";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/SkeletonList";
import { StatusBadge, briefLabel, briefTone, lessonStatusLabel, lessonStatusTone } from "@/components/ui/StatusBadge";
import { useEntitlements } from "@/hooks/useEntitlements";
import { Checkbox } from "@/components/ui/checkbox";
import { getMaxSelectableLessons, isConsecutiveSequence, isValidFreeSelection } from "@/lib/courseSelectionRules";
import type { Tables } from "@/integrations/supabase/types";
import { formatErrorMessage, formatFunctionErrorMessage } from "@/lib/errors";

interface LessonWithPlanLesson {
  id: string;
  lesson_number: number;
  status: string;
  scheduled_date: string | null;
  is_generating: boolean;
  plan_lesson: { theme: string; learning_outcome: string } | null;
  brief_status: string | null;
}

interface CourseInfo {
  id: string;
  subject: string;
  year_level: number;
  academic_year: number;
  school_name: string;
  status: string;
  curriculum_document_id: string | null;
  curriculum_link_mode: "persisted" | "session_fallback" | "missing";
}

interface CurriculumInfo {
  id: string;
  official_title: string | null;
  official_url: string | null;
  source_provider: string;
  node_count?: number;
}

interface PlanInfo {
  id: string;
  status: string;
}

type CourseRecord = Pick<
  Tables<"courses">,
  "id" | "subject" | "year_level" | "academic_year" | "status" | "curriculum_document_id"
> & {
  schools: Pick<Tables<"schools">, "official_name"> | null;
};

type CourseRecordWithoutCurriculum = Omit<CourseRecord, "curriculum_document_id"> & {
  curriculum_document_id?: null;
};

type BriefStatusRow = Pick<Tables<"lesson_briefs">, "lesson_id" | "status">;

export default function Course() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const { planType, entitlements } = useEntitlements();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumInfo | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [lessons, setLessons] = useState<LessonWithPlanLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [preparingSelection, setPreparingSelection] = useState(false);
  const [preparingFreeView, setPreparingFreeView] = useState(false);
  const [freePreparationError, setFreePreparationError] = useState<string | null>(null);
  const fallbackCurriculumId = searchParams.get("curriculum_document_id");
  const isArchived = course?.status === "ARCHIVED";
  const planValidated = plan?.status === "VALIDATED" || plan?.status === "EDITED";
  const isFreePlan = planType === "FREE";
  const defaultTab = planValidated ? (isFreePlan ? "agenda" : "planificacion") : "planificacion";
  const tabGridCols = planValidated
    ? isFreePlan
      ? "grid-cols-2"
      : "grid-cols-3"
    : "grid-cols-1";

  const selectedLessons = useMemo(
    () => lessons.filter((lesson) => selectedLessonIds.includes(lesson.id)),
    [lessons, selectedLessonIds]
  );
  const requiredFreeSelectionCount = 3;
  const maxSelectableLessons = getMaxSelectableLessons(planType, lessons.length);
  const selectedLessonNumbers = selectedLessons
    .map((lesson) => lesson.lesson_number)
    .sort((a, b) => a - b);
  const hasSequenceSelection = isConsecutiveSequence(selectedLessonNumbers);
  const selectionIsReady =
    selectedLessons.length > 0 &&
    selectedLessons.every(
      (lesson) =>
        !lesson.is_generating &&
        lesson.status !== "LOCKED" &&
        (lesson.brief_status === "READY_FOR_PRODUCTION" || lesson.brief_status === "PRODUCED")
    );
  const selectionLimitReached = selectedLessonIds.length >= maxSelectableLessons;
  const hasExactFreeSelection = isValidFreeSelection(selectedLessons.length);

  const fetchData = useCallback(async () => {
    if (!courseId) return;

    setLoading(true);

    let courseData: CourseRecord | CourseRecordWithoutCurriculum | null = null;
    const { data: courseWithCurriculum, error: courseWithCurriculumError } = await supabase
      .from("courses")
      .select("id, subject, year_level, academic_year, status, curriculum_document_id, schools(official_name)")
      .eq("id", courseId)
      .single();

    if (!courseWithCurriculumError && courseWithCurriculum) {
      courseData = courseWithCurriculum as unknown as CourseRecord;
    } else if (
      courseWithCurriculumError &&
      courseWithCurriculumError.message.includes("curriculum_document_id")
    ) {
      const { data: courseWithoutCurriculum } = await supabase
        .from("courses")
        .select("id, subject, year_level, academic_year, status, schools(official_name)")
        .eq("id", courseId)
        .single();
      courseData = courseWithoutCurriculum as unknown as CourseRecordWithoutCurriculum;
    }

    if (courseData) {
      const resolvedCurriculumId = courseData.curriculum_document_id ?? fallbackCurriculumId;

      setCourse({
        id: courseData.id,
        subject: courseData.subject,
        year_level: courseData.year_level,
        academic_year: courseData.academic_year,
        school_name: courseData.schools?.official_name ?? "Sin escuela",
        status: courseData.status,
        curriculum_document_id: resolvedCurriculumId,
        curriculum_link_mode: resolvedCurriculumId
          ? courseData.curriculum_document_id
            ? "persisted"
            : "session_fallback"
          : "missing",
      });

      if (resolvedCurriculumId) {
        const [{ data: curriculumData }, { count: nodeCount }] = await Promise.all([
          supabase
          .from("curriculum_documents")
          .select("id, official_title, official_url, source_provider")
          .eq("id", resolvedCurriculumId)
          .single(),
          supabase
            .from("curriculum_nodes")
            .select("id", { count: "exact", head: true })
            .eq("curriculum_document_id", resolvedCurriculumId),
        ]);

        setCurriculum(curriculumData ? { ...curriculumData, node_count: nodeCount || 0 } : null);
      } else {
        setCurriculum(null);
      }
    }

    const { data: planData } = await supabase
      .from("plans")
      .select("id, status")
      .eq("course_id", courseId)
      .single();

    if (planData) {
      setPlan({ id: planData.id, status: planData.status });
    }

    if (planData?.status === "VALIDATED" || planData?.status === "EDITED") {
      const { data: lessonsData } = await supabase
        .from("lessons")
        .select("id, lesson_number, status, scheduled_date, is_generating, plan_lesson_id")
        .eq("course_id", courseId)
        .order("lesson_number");

      if (lessonsData && lessonsData.length > 0) {
        const planLessonIds = lessonsData.map((lesson) => lesson.plan_lesson_id);
        const { data: planLessons } = await supabase
          .from("plan_lessons")
          .select("id, theme, learning_outcome")
          .in("id", planLessonIds);

        const lessonIds = lessonsData.map((lesson) => lesson.id);
        const { data: briefs } = await supabase
          .from("lesson_briefs")
          .select("lesson_id, status")
          .in("lesson_id", lessonIds);

        const planLessonMap = new Map((planLessons || []).map((planLesson) => [planLesson.id, planLesson]));
        const briefMap = new Map(
          ((briefs || []) as BriefStatusRow[]).map((brief) => [brief.lesson_id, brief.status])
        );

        setLessons(
          lessonsData.map((lesson) => ({
            id: lesson.id,
            lesson_number: lesson.lesson_number,
            status: lesson.status,
            scheduled_date: lesson.scheduled_date,
            is_generating: lesson.is_generating,
            plan_lesson: planLessonMap.get(lesson.plan_lesson_id) || null,
            brief_status: briefMap.get(lesson.id) || null,
          }))
        );
      } else {
        setLessons([]);
      }
    } else {
      setLessons([]);
    }

    setLoading(false);
  }, [courseId, fallbackCurriculumId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSelectedLessonIds((current) => current.filter((lessonId) => lessons.some((lesson) => lesson.id === lessonId)));
  }, [lessons]);

  useEffect(() => {
    if (!isFreePlan || !plan?.id || !course || isArchived || planValidated || preparingFreeView || freePreparationError) {
      return;
    }

    const prepareFreePlan = async () => {
      setPreparingFreeView(true);
      setFreePreparationError(null);

      try {
        const { data, error } = await supabase.rpc("validate_plan", { p_plan_id: plan.id });
        if (error) throw error;

        const result = data as unknown as { success: boolean; errors: string[] };
        if (!result.success) {
          throw new Error(result.errors.join(". "));
        }

        await fetchData();
      } catch (error: unknown) {
        setFreePreparationError(formatErrorMessage(error, "No se pudo preparar la secuencia del curso."));
      } finally {
        setPreparingFreeView(false);
      }
    };

    prepareFreePlan();
  }, [course, fetchData, freePreparationError, isArchived, isFreePlan, plan, planValidated, preparingFreeView]);

  const handlePlanValidated = () => fetchData();

  const toggleLessonSelection = (lessonId: string) => {
    const lesson = lessons.find((item) => item.id === lessonId);
    if (!lesson) return;

    setSelectedLessonIds((current) => {
      if (current.includes(lessonId)) {
        return current.filter((id) => id !== lessonId);
      }
      if (current.length >= maxSelectableLessons) {
        toast({
          title: "Límite de sesión",
          description: isFreePlan
            ? `En Free podés preparar exactamente ${requiredFreeSelectionCount} clases por sesión.`
            : `Podés seleccionar hasta ${maxSelectableLessons} clases, que son las clases disponibles en este curso.`,
          variant: "destructive",
        });
        return current;
      }
      return [...current, lessonId];
    });
  };

  const handlePrepareSelection = async () => {
    if (selectedLessons.length === 0) {
      toast({
        title: "Elegí al menos una clase",
        description: "Seleccioná una clase o una secuencia corta antes de preparar.",
        variant: "destructive",
      });
      return;
    }

    if (isFreePlan && !hasExactFreeSelection) {
      toast({
        title: "El plan Free prepara 3 clases",
        description: "En Free tenés que elegir exactamente 3 clases del mismo curso.",
        variant: "destructive",
      });
      return;
    }

    if (!isFreePlan && selectedLessons.length > 1 && !hasSequenceSelection) {
      toast({
        title: "La secuencia debe ser consecutiva",
        description: "Para preparar varias clases, elegí una secuencia continua sin saltos.",
        variant: "destructive",
      });
      return;
    }

    if (!selectionIsReady) {
      toast({
        title: "Hay clases incompletas",
        description: "Cada clase seleccionada debe tener las indicaciones listas para produccion y no estar generandose.",
        variant: "destructive",
      });
      return;
    }

    setPreparingSelection(true);

    try {
      const orderedLessonIds = [...selectedLessons]
        .sort((a, b) => a.lesson_number - b.lesson_number)
        .map((lesson) => lesson.id);

      const { data, error } = await supabase.functions.invoke("generate-materials", {
        body: {
          lesson_ids: orderedLessonIds,
          mode: orderedLessonIds.length > 1 ? "full_session" : "single",
        },
      });

      if (error) {
        toast({
          title: "Error al preparar",
          description: await formatFunctionErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      if (data?.error) {
        toast({
          title: "Error al preparar",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: orderedLessonIds.length > 1 ? "Secuencia preparada" : "Clase preparada",
        description:
          orderedLessonIds.length > 1
            ? `Se prepararon ${orderedLessonIds.length} clases de la secuencia seleccionada.`
            : "La clase seleccionada quedó preparada.",
      });
      setSelectedLessonIds([]);
      await fetchData();
    } catch (error: unknown) {
      toast({
        title: "Error al preparar",
        description: formatErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setPreparingSelection(false);
    }
  };

  const handleArchive = async () => {
    if (!courseId) return;

    setArchiving(true);
    const { error } = await supabase.from("courses").update({ status: "ARCHIVED" }).eq("id", courseId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Curso archivado" });
      fetchData();
    }
    setArchiving(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">{course?.subject ?? "Cargando..."}</h1>
              {isArchived && <StatusBadge tone="archived" label="Archivado" />}
            </div>
            {course && (
              <p className="text-sm text-muted-foreground">
                {course.school_name} · {course.year_level}° año · {course.academic_year}
              </p>
            )}
          </div>
          {course && !isArchived && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Archive className="h-4 w-4 mr-2" />
                  Archivar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archivar este curso</AlertDialogTitle>
                  <AlertDialogDescription>
                    No podras editar el plan, las lecciones ni la agenda una vez archivado.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleArchive} disabled={archiving}>
                    {archiving ? "Archivando..." : "Archivar"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {loading ? (
          <SkeletonList count={6} />
        ) : plan ? (
          <div className="space-y-4">
            <PageIntro
              eyebrow="Curso"
              title={`${course?.subject ?? "Curso"}${course?.year_level ? ` · ${course.year_level} a\u00f1o` : ""}`}
              description="Revisa la base curricular, valida la planificacion y prepara clases o secuencias con una composicion mas clara para lectura y seguimiento."
            />
            <Card>
              <CardContent className="pt-6 space-y-2">
                <p className="text-sm font-medium text-foreground">Base curricular del curso</p>
                {curriculum ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm">{curriculum.official_title || "Documento curricular asociado"}</p>
                      {course?.curriculum_link_mode === "persisted" && <Badge variant="default">Vinculo persistido</Badge>}
                      {course?.curriculum_link_mode === "session_fallback" && (
                        <Badge variant="secondary">Modo compatibilidad</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Fuente: {curriculum.source_provider}</span>
                      <span>Contenidos curriculares: {curriculum.node_count ?? 0}</span>
                      <span>Curso: {course?.subject} {course?.year_level} a\u00f1o</span>
                    </div>
                    {curriculum.source_provider === "ABC_PBA_WEB" && (
                      <p className="text-xs text-muted-foreground">
                        Documento resuelto desde ABC. La vinculacion curricular ya esta fijada, pero la extraccion profunda del contenido curricular sigue en construccion.
                      </p>
                    )}
                    {course?.curriculum_link_mode === "session_fallback" && (
                      <p className="text-xs text-muted-foreground">
                        El programa esta siendo reutilizado en esta sesion aunque la columna persistida del curso todavia no exista en el backend conectado.
                      </p>
                    )}
                    {curriculum.official_url && (
                      <a
                        href={curriculum.official_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm underline underline-offset-4"
                      >
                        Ver documento oficial
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Este curso no tiene un diseno curricular oficial asociado todavia.
                  </p>
                )}
              </CardContent>
            </Card>

            {isFreePlan && !planValidated ? (
              <Card>
                <CardContent className="py-10 text-center space-y-3">
                  <p className="text-base font-medium text-foreground">
                    {preparingFreeView ? "Preparando secuencia y clases" : "Todavia no pudimos preparar este curso"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {preparingFreeView
                      ? "La planificacion se usa en segundo plano para generar el contenido. En cuanto quede lista, vas a ver solo la secuencia y las clases."
                      : freePreparationError || "No se pudo preparar la secuencia del curso."}
                  </p>
                  {freePreparationError && (
                    <Button onClick={() => setFreePreparationError(null)} variant="outline">
                      Reintentar
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Tabs key={`${planType}-${plan?.status ?? "no-plan"}`} defaultValue={defaultTab}>
                <TabsList className={`grid w-full ${tabGridCols}`}>
                  {!isFreePlan && <TabsTrigger value="planificacion">Planificacion</TabsTrigger>}
                  {planValidated && <TabsTrigger value="agenda">{isFreePlan ? "Secuencia" : "Agenda"}</TabsTrigger>}
                  {planValidated && <TabsTrigger value="lecciones">{isFreePlan ? "Clases" : "Lecciones"}</TabsTrigger>}
                </TabsList>

                {!isFreePlan && (
                  <TabsContent value="planificacion" className="pt-4">
                    <PlanEditor
                      planId={plan.id}
                      courseId={courseId!}
                      curriculumDocumentId={course?.curriculum_document_id}
                      planStatus={plan.status}
                      onValidated={handlePlanValidated}
                      courseArchived={isArchived}
                    />
                  </TabsContent>
                )}

                {planValidated && (
                  <TabsContent value="agenda" className="pt-4">
                    <AgendaView courseId={courseId!} readOnly={isArchived} />
                  </TabsContent>
                )}

                {planValidated && (
                  <TabsContent value="lecciones" className="pt-4">
                    {lessons.length === 0 ? (
                      <EmptyState icon={BookOpen} title="No hay lecciones creadas para este curso" />
                    ) : (
                      <div className="space-y-3">
                        <Card>
                          <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">
                                Elegí una clase o una secuencia para preparar
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {isFreePlan
                                  ? "En Free tenÃ©s que elegir exactamente 3 clases del mismo curso. Pueden ser tres clases puntuales o una secuencia."
                                  : `PodÃ©s seleccionar 1 clase o una secuencia de hasta ${maxSelectableLessons} clases, que coincide con las clases existentes en el curso.`}
                              </p>
                              {selectedLessons.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {isFreePlan && !hasExactFreeSelection
                                    ? `LlevÃ¡s ${selectedLessons.length}/3 clases seleccionadas.`
                                    : isFreePlan && hasSequenceSelection
                                      ? `Secuencia seleccionada: clases ${selectedLessonNumbers[0]} a ${selectedLessonNumbers[selectedLessonNumbers.length - 1]}.`
                                      : isFreePlan
                                        ? `Clases seleccionadas: ${selectedLessonNumbers.join(", ")}.`
                                    : selectedLessons.length === 1
                                      ? `Clase ${selectedLessonNumbers[0]} seleccionada.`
                                      : hasSequenceSelection
                                      ? `Secuencia seleccionada: clases ${selectedLessonNumbers[0]} a ${selectedLessonNumbers[selectedLessonNumbers.length - 1]}.`
                                      : "La selecciÃ³n actual no forma una secuencia consecutiva."}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Button
                                variant="outline"
                                onClick={() => setSelectedLessonIds([])}
                                disabled={selectedLessonIds.length === 0 || preparingSelection}
                              >
                                Limpiar selecciÃ³n
                              </Button>
                              <Button
                                onClick={handlePrepareSelection}
                                disabled={
                                  preparingSelection ||
                                  selectedLessonIds.length === 0 ||
                                  (isFreePlan && !hasExactFreeSelection)
                                }
                              >
                                <Sparkles className="mr-2 h-4 w-4" />
                                {preparingSelection
                                  ? "Preparando..."
                                  : isFreePlan || selectedLessons.length > 1
                                    ? "Preparar secuencia"
                                    : "Preparar clase"}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        {lessons.map((lesson) => (
                          <Card key={lesson.id} className="transition-colors hover:border-primary/50">
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={selectedLessonIds.includes(lesson.id)}
                                    onCheckedChange={() => toggleLessonSelection(lesson.id)}
                                    disabled={
                                      preparingSelection ||
                                      (!selectedLessonIds.includes(lesson.id) && selectionLimitReached)
                                    }
                                    aria-label={`Seleccionar lecciÃ³n ${lesson.lesson_number}`}
                                  />
                                  <div className="space-y-1">
                                    <CardTitle className="text-base">
                                      Leccion {lesson.lesson_number}
                                      {lesson.plan_lesson?.theme ? ` - ${lesson.plan_lesson.theme}` : ""}
                                    </CardTitle>
                                    {lesson.plan_lesson?.learning_outcome && (
                                      <p className="text-sm text-muted-foreground line-clamp-2">
                                        {lesson.plan_lesson.learning_outcome}
                                      </p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                      {lesson.brief_status === "READY_FOR_PRODUCTION" || lesson.brief_status === "PRODUCED"
                                        ? "Lista para preparar."
                                        : "Completa las indicaciones antes de prepararla."}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                                  <div className="flex flex-wrap gap-1.5">
                                    <StatusBadge
                                      tone={lessonStatusTone(lesson.status)}
                                      label={lessonStatusLabel(lesson.status)}
                                    />
                                    {lesson.is_generating && (
                                      <Badge variant="outline" className="animate-pulse">
                                        Generando...
                                      </Badge>
                                    )}
                                    <StatusBadge
                                      tone={briefTone(lesson.brief_status)}
                                      label={briefLabel(lesson.brief_status)}
                                    />
                                  </div>
                                  <Button asChild variant="outline" size="sm">
                                    <Link to={`/lesson/${lesson.id}`}>Abrir clase</Link>
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                )}
              </Tabs>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}

