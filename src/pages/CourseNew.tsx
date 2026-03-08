import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatErrorMessage } from "@/lib/errors";

type SchoolType = "COMUN" | "TECNICA";
type Cycle = "BASIC" | "UPPER";
type ResolutionStatus = "idle" | "resolving" | "resolved" | "ambiguous" | "not_found" | "error";
type CourseContextMode = "NINGUNA" | "ORIENTACION" | "TECNICATURA";

interface SchoolOption {
  id: string;
  official_name: string;
  school_type: SchoolType;
}

interface CurriculumCandidate {
  id: string;
  subject?: string;
  cycle?: Cycle;
  year_level?: number;
  display_title: string;
  official_url: string | null;
  official_title: string | null;
  source_provider: string;
  fetched_at: string | null;
  school_type: SchoolType | null;
  orientation: string | null;
  speciality: string | null;
  is_official_domain: boolean;
}

interface SupportedProgram {
  subject: string;
  cycle: Cycle;
  year_level: number;
  source_provider: string;
  school_type: SchoolType | null;
  orientation: string | null;
  speciality: string | null;
}

const ORIENTATION_SUGGESTIONS = [
  "Ciencias Sociales",
  "Ciencias Naturales",
  "Economía y Administración",
  "Arte",
  "Comunicación",
  "Educación Física",
  "Lenguas Extranjeras",
];

const TECH_SPECIALITY_SUGGESTIONS = [
  "Técnico en Aeronáutica",
  "Técnico en Automotores",
  "Técnico en Aviónica",
  "Técnico en Computación",
  "Técnico en Electromecánica",
  "Técnico en Electrónica",
  "Técnico en Maestro Mayor de Obras",
  "Técnico en Multimedios",
  "Técnico en Naval",
  "Técnico en Química",
  "Técnico en Servicios Turísticos",
  "Técnico en Informática Personal y Profesional",
  "Técnico en Administración de las Organizaciones",
  "Técnico en Producción Agropecuaria con Orientación en Agroalimentos",
  "Informática",
  "Programación",
  "Alimentos",
  "Administración agropecuaria",
];

const SPECIALITY_ALIAS_TO_CANON: Record<string, string> = {
  informatica: "Técnico en Informática Personal y Profesional",
  programacion: "Técnico en Informática Personal y Profesional",
  alimentos: "Técnico en Producción Agropecuaria con Orientación en Agroalimentos",
  "administracion agropecuaria": "Técnico en Producción Agropecuaria con Orientación en Agroalimentos",
};

function candidateScopeLabel(candidate: Pick<CurriculumCandidate, "school_type" | "orientation" | "speciality">): string {
  const parts = [
    candidate.school_type || "GenÃ©rico",
    candidate.orientation || null,
    candidate.speciality || null,
  ].filter(Boolean);

  return parts.join(" | ");
}

function normalize(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isAllowedOfficialUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "abc.gob.ar";
  } catch {
    return false;
  }
}

function isMissingCurriculumColumnError(error: { message?: string } | null | undefined): boolean {
  const message = error?.message || "";
  return message.includes("curriculum_document_id") && message.includes("courses");
}

function canonicalizeSpeciality(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = normalize(trimmed);
  return SPECIALITY_ALIAS_TO_CANON[normalized] || trimmed;
}

function scoreCandidate(
  candidate: CurriculumCandidate,
  schoolType: SchoolType,
  orientation: string | null,
  speciality: string | null
): number {
  let score = 0;

  if (candidate.school_type === schoolType) score += 4;
  else if (!candidate.school_type) score += 1;

  const wantedOrientation = normalize(orientation);
  const candidateOrientation = normalize(candidate.orientation);
  if (wantedOrientation && candidateOrientation === wantedOrientation) score += 3;
  else if (!candidateOrientation) score += 1;

  const wantedSpeciality = normalize(speciality);
  const candidateSpeciality = normalize(candidate.speciality);
  if (wantedSpeciality && candidateSpeciality === wantedSpeciality) score += 3;
  else if (!candidateSpeciality) score += 1;

  if (isAllowedOfficialUrl(candidate.official_url)) score += 2;

  return score;
}

interface WizardState {
  province: string;
  schoolId: string;
  schoolType: SchoolType;
  cycle: Cycle | "";
  yearLevel: number | null;
  subject: string;
  contextMode: CourseContextMode;
  orientation: string;
  speciality: string;
  newSchoolName: string;
  newSchoolDistrict: string;
  newSchoolLocality: string;
  newSchoolType: SchoolType;
  creatingNewSchool: boolean;
  scheduleSlots: Array<{
    day_of_week: string;
    start_time: string;
    end_time: string;
    module_count: string;
  }>;
}

const WEEKDAY_OPTIONS = [
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "MiÃ©rcoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
];

function contextModeLabel(value: CourseContextMode): string {
  if (value === "ORIENTACION") return "Orientaci\u00f3n";
  if (value === "TECNICATURA") return "Tecnicatura";
  return "Ninguna / Normal";
}

function formatScheduleSlotSummary(slot: WizardState["scheduleSlots"][number]): string {
  const dayLabel = WEEKDAY_OPTIONS.find((option) => option.value === slot.day_of_week)?.label || "D\u00eda";
  const modulesLabel = slot.module_count === "1" ? "1 m\u00f3dulo" : `${slot.module_count} m\u00f3dulos`;
  return `${dayLabel} · ${slot.start_time} a ${slot.end_time} · ${modulesLabel}`;
}

export default function CourseNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryCycle = searchParams.get("cycle");
  const initialCycle = queryCycle === "BASIC" || queryCycle === "UPPER" ? queryCycle : "";
  const querySchoolType = searchParams.get("school_type");
  const initialSchoolType = querySchoolType === "COMUN" || querySchoolType === "TECNICA" ? querySchoolType : "COMUN";
  const queryYearLevel = Number(searchParams.get("year_level"));
  const initialYearLevel = Number.isInteger(queryYearLevel) && queryYearLevel >= 1 && queryYearLevel <= 6 ? queryYearLevel : null;
  const initialCurriculumId = searchParams.get("curriculum_document_id") || "";
  const [step, setStep] = useState(1);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [supportedPrograms, setSupportedPrograms] = useState<SupportedProgram[]>([]);
  const [creating, setCreating] = useState(false);
  const [resolutionStatus, setResolutionStatus] = useState<ResolutionStatus>("idle");
  const [resolutionError, setResolutionError] = useState("");
  const [curriculumCandidates, setCurriculumCandidates] = useState<CurriculumCandidate[]>([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState(initialCurriculumId);
  const [officialIndexUrl, setOfficialIndexUrl] = useState(
    "https://abc.gob.ar/secretarias/areas/subsecretaria-de-educacion/educacion-secundaria/educacion-secundaria/disenos-curriculares"
  );

  const [state, setState] = useState<WizardState>({
    province: "PBA",
    schoolId: "",
    schoolType: initialSchoolType,
    cycle: initialCycle,
    yearLevel: initialYearLevel,
    subject: searchParams.get("subject") || "",
    contextMode: searchParams.get("speciality")
      ? "TECNICATURA"
      : searchParams.get("orientation")
      ? "ORIENTACION"
      : "NINGUNA",
    orientation: searchParams.get("orientation") || "",
    speciality: searchParams.get("speciality") || "",
    newSchoolName: "",
    newSchoolDistrict: "",
    newSchoolLocality: "",
    newSchoolType: "COMUN",
    creatingNewSchool: false,
    scheduleSlots: [{ day_of_week: "1", start_time: "", end_time: "", module_count: "2" }],
  });

  const selectedSchool = schools.find((school) => school.id === state.schoolId);
  const selectedCurriculum =
    curriculumCandidates.find((candidate) => candidate.id === selectedCurriculumId) || null;
  const availableCycles = useMemo(() => {
    if (!state.subject) return [];
    return ["BASIC", "UPPER"] as Cycle[];
  }, [state.subject]);

  const yearOptions = useMemo(() => {
    if (!state.subject || !state.cycle) return [];
    return state.cycle === "BASIC" ? [1, 2, 3] : [4, 5, 6];
  }, [state.cycle, state.subject]);
  const matchingPrograms = useMemo(() => {
    if (!state.subject || !state.cycle || !state.yearLevel) return [];
    return supportedPrograms.filter(
      (program) =>
        normalize(program.subject) === normalize(state.subject) &&
        program.cycle === state.cycle &&
        program.year_level === state.yearLevel
    );
  }, [state.cycle, state.subject, state.yearLevel, supportedPrograms]);
  const manualOrientation = state.contextMode === "ORIENTACION";
  const manualSpeciality = state.contextMode === "TECNICATURA";
  const needsOrientation = useMemo(() => {
    if (manualOrientation) return state.cycle === "UPPER";
    if (!(state.cycle === "UPPER" && state.schoolType === "COMUN")) return false;
    return matchingPrograms.some((program) => !!program.orientation);
  }, [manualOrientation, matchingPrograms, state.cycle, state.schoolType]);
  const needsSpeciality = useMemo(() => {
    if (manualSpeciality) return state.cycle === "UPPER";
    if (!(state.cycle === "UPPER" && state.schoolType === "TECNICA")) return false;
    return matchingPrograms.some((program) => !!program.speciality);
  }, [manualSpeciality, matchingPrograms, state.cycle, state.schoolType]);
  const wizardSteps = useMemo(
    () => [
      { num: 1, label: "Provincia" },
      { num: 2, label: "Materia" },
      { num: 3, label: "Escuela" },
      { num: 4, label: "Ciclo" },
      { num: 5, label: "A\u00f1o" },
      { num: 6, label: "Cursada" },
      { num: 7, label: "Programa oficial" },
      { num: 8, label: "Confirmaci\u00f3n" },
    ],
    []
  );
  const scheduleIsValid = useMemo(
    () =>
      state.scheduleSlots.length > 0 &&
      state.scheduleSlots.every(
        (slot) =>
          !!slot.day_of_week &&
          !!slot.start_time &&
          !!slot.end_time &&
          !!slot.module_count &&
          slot.end_time > slot.start_time
      ),
    [state.scheduleSlots]
  );

  useEffect(() => {
    supabase
      .from("schools")
      .select("id, official_name, school_type")
      .order("official_name")
      .then(({ data }) => {
        if (data) setSchools(data as SchoolOption[]);
      });
  }, []);

  useEffect(() => {
    if (!state.province) return;

    supabase
      .from("curriculum_documents")
      .select("subject, cycle, year_level, source_provider, school_type, orientation, speciality")
      .eq("province", state.province)
      .eq("status", "VERIFIED")
      .then(({ data }) => {
        setSupportedPrograms((data || []) as SupportedProgram[]);
      });
  }, [state.province]);

  useEffect(() => {
    setResolutionStatus("idle");
    setResolutionError("");
    setCurriculumCandidates([]);
    setSelectedCurriculumId("");
  }, [state.subject, state.cycle, state.yearLevel, state.schoolType, state.contextMode, state.orientation, state.speciality]);

  useEffect(() => {
    if (!initialCurriculumId) return;

    let active = true;

    const loadSelectedCurriculum = async () => {
      const { data, error } = await supabase
        .from("curriculum_documents")
        .select("id, subject, cycle, year_level, official_url, official_title, source_provider, fetched_at, school_type, orientation, speciality")
        .eq("id", initialCurriculumId)
        .maybeSingle();

      if (!active || error || !data) return;

      setCurriculumCandidates([
        {
          ...data,
          display_title: data.official_title || data.subject,
          is_official_domain: isAllowedOfficialUrl(data.official_url),
        } as CurriculumCandidate,
      ]);
      setSelectedCurriculumId(data.id);
      setResolutionStatus("resolved");
      setResolutionError("");
    };

    loadSelectedCurriculum();

    return () => {
      active = false;
    };
  }, [initialCurriculumId]);

  useEffect(() => {
    if (initialCurriculumId) return;

    const shouldResolve =
      !!state.subject &&
      !!state.cycle &&
      !!state.yearLevel &&
      (!needsOrientation || !!state.orientation.trim()) &&
      (!needsSpeciality || !!state.speciality.trim());

    if (!shouldResolve) return;

    let active = true;

      const resolveCurriculum = async () => {
        setResolutionStatus("resolving");
        setResolutionError("");

        const { data, error } = await supabase.functions.invoke("resolve-curriculum-document", {
          body: {
            province: state.province,
            subject: state.subject,
            cycle: state.cycle,
            year_level: state.yearLevel,
            school_type: state.schoolType,
            orientation: needsOrientation ? state.orientation : null,
            speciality: needsSpeciality ? canonicalizeSpeciality(state.speciality) : null,
          },
        });

        if (!active) return;

        if (error) {
          setCurriculumCandidates([]);
          setSelectedCurriculumId("");
          setResolutionStatus("error");
          setResolutionError(error.message);
          return;
        }

        if (data?.official_index_url) {
          setOfficialIndexUrl(data.official_index_url);
        }

        if (data?.status === "resolved" && data.document) {
          setCurriculumCandidates([data.document]);
          setSelectedCurriculumId(data.document.id);
          setResolutionStatus("resolved");
          setResolutionError("");
          return;
        }

        if (data?.status === "ambiguous" && Array.isArray(data.candidates)) {
          setCurriculumCandidates(data.candidates);
          setSelectedCurriculumId("");
          setResolutionStatus("ambiguous");
          setResolutionError("");
          return;
        }

        setCurriculumCandidates([]);
        setSelectedCurriculumId("");
        setResolutionStatus("not_found");
        setResolutionError(data?.reason || "No se encontrÃ³ un programa disponible para esa combinaciÃ³n.");
      };

    resolveCurriculum();
    return () => {
      active = false;
    };
  }, [
    initialCurriculumId,
    needsOrientation,
    needsSpeciality,
    state.cycle,
    state.orientation,
    state.province,
    state.schoolType,
    state.speciality,
    state.subject,
    state.yearLevel,
  ]);

  const canAdvance = (): boolean => {
    switch (step) {
      case 1:
        return true;
      case 2:
        return !!state.subject;
      case 3:
        return (
          !!state.schoolId &&
          (state.contextMode !== "ORIENTACION" || !!state.orientation.trim()) &&
          (state.contextMode !== "TECNICATURA" || !!state.speciality.trim())
        );
      case 4:
        return !!state.cycle;
      case 5:
        return !!state.yearLevel;
      case 6:
        return scheduleIsValid;
      case 7:
        return !!selectedCurriculumId && (resolutionStatus === "resolved" || resolutionStatus === "ambiguous");
      case 8:
        return !!selectedCurriculumId && (resolutionStatus === "resolved" || resolutionStatus === "ambiguous");
      default:
        return true;
    }
  };

  const nextStep = () => {
    let next = step + 1;
    if (next > 8) next = 8;
    setStep(next);
  };

  const prevStep = () => {
    let prev = step - 1;
    if (prev < 1) prev = 1;
    setStep(prev);
  };

  const updateScheduleSlot = (
    index: number,
    field: keyof WizardState["scheduleSlots"][number],
    value: string
  ) => {
    setState((prev) => ({
      ...prev,
      scheduleSlots: prev.scheduleSlots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, [field]: value } : slot
      ),
    }));
  };

  const addScheduleSlot = () => {
    setState((prev) => ({
      ...prev,
      scheduleSlots: [
        ...prev.scheduleSlots,
        { day_of_week: "1", start_time: "", end_time: "", module_count: "2" },
      ],
    }));
  };

  const removeScheduleSlot = (index: number) => {
    setState((prev) => ({
      ...prev,
      scheduleSlots:
        prev.scheduleSlots.length === 1
          ? prev.scheduleSlots
          : prev.scheduleSlots.filter((_, slotIndex) => slotIndex !== index),
    }));
  };

  const handleCreateSchool = async () => {
    if (!state.newSchoolName.trim()) return;

    const { data, error } = await supabase
      .from("schools")
      .insert({
        official_name: state.newSchoolName.trim(),
        district: state.newSchoolDistrict.trim(),
        locality: state.newSchoolLocality.trim(),
        school_type: state.newSchoolType,
        user_created: true,
        created_by: user?.id,
      })
      .select("id, official_name, school_type")
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    if (data) {
      setSchools((prev) => [...prev, data as SchoolOption]);
      setState((prev) => ({
        ...prev,
        schoolId: data.id,
        schoolType: data.school_type as SchoolType,
        creatingNewSchool: false,
        newSchoolName: "",
        newSchoolDistrict: "",
        newSchoolLocality: "",
      }));
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!selectedCurriculumId) {
      toast({
        title: "Falta programa oficial",
        description: "ResolvÃ© y confirmÃ¡ primero el programa oficial del curso.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      let limitData: { can_create: boolean; current: number; max: number } | null = null;
      const { data: remoteLimitData, error: limitError } = await supabase.functions.invoke("check-course-limit");
      if (!limitError && remoteLimitData) {
        limitData = remoteLimitData as { can_create: boolean; current: number; max: number };
      } else {
        const { count, error: countError } = await supabase
          .from("courses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "ACTIVE");
        if (countError) throw countError;
        const current = count || 0;
        limitData = { can_create: current < 1, current, max: 1 };
      }

      if (!limitData.can_create) {
        toast({
          title: "LÃ­mite alcanzado",
          description: `Alcanzaste el lÃ­mite de cursos (${limitData.current}/${limitData.max})`,
          variant: "destructive",
        });
        return;
      }

      const baseCoursePayload = {
        user_id: user.id,
        school_id: state.schoolId,
        subject: state.subject,
        year_level: state.yearLevel!,
        academic_year: new Date().getFullYear(),
        orientation: needsOrientation ? state.orientation : null,
        speciality: needsSpeciality ? canonicalizeSpeciality(state.speciality) : null,
      };

      const courseDetailUrl = (courseId: string) => {
        const params = new URLSearchParams();
        if (selectedCurriculumId) params.set("curriculum_document_id", selectedCurriculumId);
        const query = params.toString();
        return query ? `/course/${courseId}?${query}` : `/course/${courseId}`;
      };

      let usedLegacyCourseInsert = false;
      let course: { id: string } | null = null;

      const { data: courseWithCurriculum, error: courseWithCurriculumError } = await supabase
        .from("courses")
        .insert({
          ...baseCoursePayload,
          curriculum_document_id: selectedCurriculumId,
        })
        .select("id")
        .single();

      if (!courseWithCurriculumError && courseWithCurriculum) {
        course = courseWithCurriculum;
      } else if (isMissingCurriculumColumnError(courseWithCurriculumError)) {
        usedLegacyCourseInsert = true;

        const { data: legacyCourse, error: legacyCourseError } = await supabase
          .from("courses")
          .insert(baseCoursePayload)
          .select("id")
          .single();

        if (legacyCourseError || !legacyCourse) throw legacyCourseError;
        course = legacyCourse;
      } else {
        throw courseWithCurriculumError;
      }

      const scheduleSlotRows = state.scheduleSlots.map((slot, index) => ({
        course_id: course!.id,
        day_of_week: parseInt(slot.day_of_week, 10),
        start_time: slot.start_time,
        end_time: slot.end_time,
        module_count: parseInt(slot.module_count, 10),
        order_index: index,
      }));
      const { error: scheduleSlotsError } = await supabase.from("course_schedule_slots").insert(scheduleSlotRows);
      if (scheduleSlotsError) throw scheduleSlotsError;

      const { data: plan, error: planErr } = await supabase
        .from("plans")
        .insert({ course_id: course!.id })
        .select("id")
        .single();
      if (planErr) throw planErr;

      const planLessons = Array.from({ length: 28 }, (_, index) => ({
        plan_id: plan!.id,
        lesson_number: index + 1,
        term: index < 14 ? 1 : 2,
      }));
      const { error: planLessonsError } = await supabase.from("plan_lessons").insert(planLessons);
      if (planLessonsError) throw planLessonsError;

      const { error: bootstrapError } = await supabase.functions.invoke("bootstrap-course-plan", {
        body: {
          course_id: course!.id,
          plan_id: plan!.id,
          curriculum_document_id: selectedCurriculumId,
        },
      });
      if (bootstrapError) {
        toast({
          title: "Curso creado con bootstrap pendiente",
          description: "El curso se creÃ³, pero el borrador inicial del plan no pudo completarse automÃ¡ticamente.",
          variant: "destructive",
        });
        navigate(courseDetailUrl(course!.id));
        return;
      }

      toast(
        usedLegacyCourseInsert
          ? {
              title: "Curso creado con compatibilidad",
              description:
                "El curso se creÃ³ en una base sin curriculum_document_id. El backend de Lovable Cloud sigue desactualizado.",
            }
          : {
              title: "Curso creado",
              description: "El curso quedÃ³ vinculado a su programa oficial y recibiÃ³ un borrador inicial del plan.",
            }
      );
      navigate(courseDetailUrl(course!.id));
    } catch (err: unknown) {
      toast({ title: "Error", description: formatErrorMessage(err), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Nuevo curso</h1>
            <p className="text-sm text-muted-foreground">
              Paso {wizardSteps.findIndex((item) => item.num === step) + 1} de {wizardSteps.length} â€”{" "}
              {wizardSteps.find((item) => item.num === step)?.label}
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-4">
          <Progress value={((wizardSteps.findIndex((item) => item.num === step) + 1) / wizardSteps.length) * 100} className="h-1.5" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {step === 1 && "Provincia"}
              {step === 2 && "Materia"}
              {step === 3 && "Escuela"}
              {step === 4 && "Ciclo"}
              {step === 5 && "A\u00f1o"}
              {step === 6 && "Cursada"}
              {step === 7 && "Programa oficial"}
              {step === 8 && "Confirmaci\u00f3n"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <div className="space-y-2">
                <Label>Provincia</Label>
                <Input value="Provincia de Buenos Aires" disabled />
                <p className="text-xs text-muted-foreground">Provincia fija para esta etapa del producto.</p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <Label>Materia</Label>
                <Input
                  value={state.subject}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      subject: event.target.value,
                      cycle: "",
                      yearLevel: null,
                      contextMode: "NINGUNA",
                      orientation: "",
                      speciality: "",
                    }))
                  }
                  placeholder="Ej: FilosofÃ­a, Historia, MatemÃ¡tica..."
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                {!state.creatingNewSchool ? (
                  <>
                    <div className="space-y-2">
                      <Label>Seleccionar escuela</Label>
                      <Select
                        value={state.schoolId}
                        onValueChange={(value) => {
                          const school = schools.find((item) => item.id === value);
                          setState((prev) => ({
                            ...prev,
                            schoolId: value,
                            schoolType: prev.contextMode === "TECNICATURA" ? "TECNICA" : school?.school_type || "COMUN",
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="ElegÃ­ una escuela..." />
                        </SelectTrigger>
                        <SelectContent>
                          {schools.map((school) => (
                            <SelectItem key={school.id} value={school.id}>
                              {school.official_name} ({school.school_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Modalidad del curso</Label>
                      <Select
                        value={state.contextMode}
                        onValueChange={(value) =>
                          setState((prev) => ({
                            ...prev,
                            contextMode: value as CourseContextMode,
                            orientation: value === "ORIENTACION" ? prev.orientation : "",
                            speciality: value === "TECNICATURA" ? prev.speciality : "",
                            schoolType:
                              value === "TECNICATURA"
                                ? "TECNICA"
                                : selectedSchool?.school_type || prev.schoolType,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NINGUNA">Ninguna / Normal</SelectItem>
                          <SelectItem value="ORIENTACION">OrientaciÃ³n</SelectItem>
                          <SelectItem value="TECNICATURA">Tecnicatura</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        DefinÃ­ si este curso usa orientaciÃ³n, tecnicatura o ninguna modalidad extra.
                      </p>
                    </div>
                    {state.contextMode === "ORIENTACION" && (
                      <div className="space-y-2">
                        <Label>OrientaciÃ³n</Label>
                        <Input
                          list="orientation-options"
                          value={state.orientation}
                          onChange={(event) =>
                            setState((prev) => ({ ...prev, orientation: event.target.value }))
                          }
                          placeholder="Ej: Ciencias Sociales, EconomÃ­a y AdministraciÃ³n..."
                        />
                        <datalist id="orientation-options">
                          {ORIENTATION_SUGGESTIONS.map((orientation) => (
                            <option key={orientation} value={orientation} />
                          ))}
                        </datalist>
                        <p className="text-xs text-muted-foreground">
                          PodÃ©s elegir una sugerencia oficial o escribir una variante local.
                        </p>
                      </div>
                    )}
                    {state.contextMode === "TECNICATURA" && (
                      <div className="space-y-2">
                        <Label>Tecnicatura / especialidad</Label>
                        <Input
                          list="speciality-options"
                          value={state.speciality}
                          onChange={(event) =>
                            setState((prev) => ({ ...prev, speciality: event.target.value }))
                          }
                          placeholder="Ej: TÃ©cnico en InformÃ¡tica Personal y Profesional..."
                        />
                        <datalist id="speciality-options">
                          {TECH_SPECIALITY_SUGGESTIONS.map((speciality) => (
                            <option key={speciality} value={speciality} />
                          ))}
                        </datalist>
                        <p className="text-xs text-muted-foreground">
                          Alias locales como â€œInformÃ¡ticaâ€ o â€œProgramaciÃ³nâ€ se normalizan al nombre canÃ³nico.
                        </p>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setState((prev) => ({ ...prev, creatingNewSchool: true }))}
                    >
                      + Crear nueva escuela
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3 rounded-md border p-4">
                    <p className="text-sm font-medium">Nueva escuela</p>
                    <div className="space-y-2">
                      <Label>Nombre oficial</Label>
                      <Input
                        value={state.newSchoolName}
                        onChange={(event) =>
                          setState((prev) => ({ ...prev, newSchoolName: event.target.value }))
                        }
                        placeholder="Ej: E.E.S. N 5"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Distrito</Label>
                        <Input
                          value={state.newSchoolDistrict}
                          onChange={(event) =>
                            setState((prev) => ({ ...prev, newSchoolDistrict: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Localidad</Label>
                        <Input
                          value={state.newSchoolLocality}
                          onChange={(event) =>
                            setState((prev) => ({ ...prev, newSchoolLocality: event.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select
                        value={state.newSchoolType}
                        onValueChange={(value) =>
                          setState((prev) => ({ ...prev, newSchoolType: value as SchoolType }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="COMUN">ComÃºn</SelectItem>
                          <SelectItem value="TECNICA">TÃ©cnica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCreateSchool} disabled={!state.newSchoolName.trim()}>
                        Crear
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setState((prev) => ({ ...prev, creatingNewSchool: false }))}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-2">
                <Label>Ciclo</Label>
                <Select
                  value={state.cycle}
                  onValueChange={(value) =>
                    setState((prev) => ({
                      ...prev,
                      cycle: value as Cycle,
                      yearLevel: null,
                      ...(value === "BASIC"
                        ? {
                            contextMode: "NINGUNA" as CourseContextMode,
                            orientation: "",
                            speciality: "",
                          }
                        : {}),
                    }))
                  }
                >
                  <SelectTrigger>
                        <SelectValue placeholder="ElegÃ­ ciclo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCycles.includes("BASIC") && (
                          <SelectItem value="BASIC">Ciclo BÃ¡sico (1 a 3)</SelectItem>
                        )}
                        {availableCycles.includes("UPPER") && (
                          <SelectItem value="UPPER">Ciclo Superior (4 a 6)</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      SeleccionÃ¡ el ciclo para ayudar a resolver el programa oficial correcto.
                    </p>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-2">
                <Label>A\u00f1o</Label>
                <Select
                  value={state.yearLevel?.toString() || ""}
                  onValueChange={(value) =>
                    setState((prev) => ({ ...prev, yearLevel: parseInt(value, 10) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Eleg\u00ed a\u00f1o..." />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year} a\u00f1o
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Seleccion\u00e1 el a\u00f1o para ajustar la resoluci\u00f3n del dise\u00f1o curricular.
                </p>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Cursada semanal</Label>
                  <p className="text-sm text-muted-foreground">
                    Defin\u00ed los d\u00edas, horarios y cantidad de m\u00f3dulos. Esta configuraci\u00f3n se usa para organizar las 28 clases del a\u00f1o desde el inicio.
                  </p>
                </div>

                <div className="space-y-3">
                  {state.scheduleSlots.map((slot, index) => (
                    <div key={`schedule-slot-${index}`} className="rounded-xl border bg-muted/20 p-4">
                      <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_1fr_0.8fr_auto]">
                        <div className="space-y-2">
                          <Label>D\u00eda</Label>
                          <Select
                            value={slot.day_of_week}
                            onValueChange={(value) => updateScheduleSlot(index, "day_of_week", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WEEKDAY_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Desde</Label>
                          <Input
                            type="time"
                            value={slot.start_time}
                            onChange={(event) => updateScheduleSlot(index, "start_time", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Hasta</Label>
                          <Input
                            type="time"
                            value={slot.end_time}
                            onChange={(event) => updateScheduleSlot(index, "end_time", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>M\u00f3dulos</Label>
                          <Input
                            type="number"
                            min="1"
                            max="8"
                            value={slot.module_count}
                            onChange={(event) => updateScheduleSlot(index, "module_count", event.target.value)}
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeScheduleSlot(index)}
                            disabled={state.scheduleSlots.length === 1}
                            aria-label={`Quitar horario ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {slot.start_time && slot.end_time ? formatScheduleSlotSummary(slot) : "Complet\u00e1 este horario para incorporarlo a la cursada."}
                      </p>
                    </div>
                  ))}
                </div>

                <Button type="button" variant="outline" onClick={addScheduleSlot}>
                  Agregar otro horario
                </Button>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Programa oficial</Label>
                  <p className="text-sm text-muted-foreground">
                    Antes de crear el curso resolvemos el dise\u00f1o curricular oficial para que la planificaci\u00f3n tenga una base curricular expl\u00edcita.
                  </p>
                </div>

                {resolutionStatus === "resolving" && (
                  <div className="rounded-md border p-4">
                    <div className="curriculum-book-loader">
                      <div className="curriculum-book-icon" aria-hidden="true">
                        <span className="curriculum-book-cover" />
                        <span className="curriculum-book-page curriculum-book-page-1" />
                        <span className="curriculum-book-page curriculum-book-page-2" />
                        <span className="curriculum-book-page curriculum-book-page-3" />
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>Buscando y resolviendo el programa oficial correspondiente...</p>
                        <p className="text-xs">Revisamos base curricular, coincidencias y dominio oficial.</p>
                      </div>
                    </div>
                  </div>
                )}

                {(resolutionStatus === "resolved" || resolutionStatus === "ambiguous") && selectedCurriculum && (
                  <div className="space-y-3 rounded-md border p-4">
                    {resolutionStatus === "ambiguous" && curriculumCandidates.length > 1 && (
                      <div className="space-y-2">
                        <Label>Eleg\u00ed el documento correcto</Label>
                        <Select value={selectedCurriculumId} onValueChange={setSelectedCurriculumId}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {curriculumCandidates.map((candidate) => (
                              <SelectItem key={candidate.id} value={candidate.id}>
                                {candidate.display_title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-muted-foreground">Documento:</span> {selectedCurriculum.display_title}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Fuente:</span> {selectedCurriculum.source_provider}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Dominio oficial:</span>{" "}
                        {selectedCurriculum.is_official_domain ? "S\u00ed" : "No verificado"}
                      </p>
                    </div>

                    {selectedCurriculum.official_url ? (
                      <a
                        href={selectedCurriculum.official_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm underline underline-offset-4"
                      >
                        Ver documento oficial
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        El documento fue resuelto en la base curricular, pero todav\u00eda no tiene URL oficial registrada.
                      </p>
                    )}
                  </div>
                )}

                {resolutionStatus === "ambiguous" && !selectedCurriculum && curriculumCandidates.length > 0 && (
                  <div className="space-y-3 rounded-md border border-warning/40 bg-warning/5 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Hay m\u00e1s de un programa posible para esta combinaci\u00f3n.</p>
                      <p className="text-sm text-muted-foreground">
                        Revis\u00e1 el alcance de cada documento y seleccion\u00e1 manualmente el correcto antes de crear el curso.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {curriculumCandidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => setSelectedCurriculumId(candidate.id)}
                          className="w-full rounded-md border bg-background p-3 text-left transition-colors hover:border-primary/50"
                        >
                          <p className="font-medium text-foreground">{candidate.display_title}</p>
                          <p className="text-xs text-muted-foreground">{candidateScopeLabel(candidate)}</p>
                          <p className="text-xs text-muted-foreground">
                            Fuente: {candidate.source_provider} | Dominio oficial: {candidate.is_official_domain ? "S\u00ed" : "No verificado"}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(resolutionStatus === "not_found" || resolutionStatus === "error") && (
                  <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
                    <p className="font-medium">No se pudo resolver el programa oficial.</p>
                    {resolutionError && <p className="text-muted-foreground">{resolutionError}</p>}
                    <p className="text-muted-foreground">
                      Esta instancia ya no admite carga manual. La base curricular solo acepta documentos resueltos o sincronizados desde `abc.gob.ar`.
                      Si necesitas importar un PDF manual, hacelo desde Sincronizar ABC con un plan BASICO o PREMIUM.
                    </p>
                    <a
                      href={officialIndexUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 underline underline-offset-4"
                    >
                      Revisar \u00edndice oficial de dise\u00f1os curriculares
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {step === 8 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Provincia:</span>
                  <span>PBA</span>
                  <span className="text-muted-foreground">Materia:</span>
                  <span>{state.subject || "-"}</span>
                  <span className="text-muted-foreground">Escuela:</span>
                  <span>{selectedSchool?.official_name || "-"}</span>
                  <span className="text-muted-foreground">Tipo:</span>
                  <span>{state.schoolType}</span>
                  <span className="text-muted-foreground">Ciclo:</span>
                  <span>{state.cycle === "BASIC" ? "B\u00e1sico" : "Superior"}</span>
                  <span className="text-muted-foreground">A\u00f1o:</span>
                  <span>{state.yearLevel}</span>
                  <span className="text-muted-foreground">Modalidad:</span>
                  <span>{contextModeLabel(state.contextMode)}</span>
                  {needsOrientation && (
                    <>
                      <span className="text-muted-foreground">Orientaci\u00f3n:</span>
                      <span>{state.orientation}</span>
                    </>
                  )}
                  {needsSpeciality && (
                    <>
                      <span className="text-muted-foreground">Especialidad:</span>
                      <span>{canonicalizeSpeciality(state.speciality)}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Programa oficial:</span>
                  <span>{selectedCurriculum?.display_title || "No resuelto"}</span>
                </div>

                <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
                  <p className="text-sm font-medium text-foreground">Cursada configurada</p>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {state.scheduleSlots.map((slot, index) => (
                      <p key={`schedule-summary-${index}`}>{formatScheduleSlotSummary(slot)}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={prevStep} disabled={step === 1}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>
              {step === 8 ? (
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Crear curso
                </Button>
              ) : (
                <Button onClick={nextStep} disabled={!canAdvance()}>
                  Siguiente
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


