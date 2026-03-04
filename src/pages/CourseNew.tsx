import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2, Upload } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SchoolType = "COMUN" | "TECNICA";
type Cycle = "BASIC" | "UPPER";
type ResolutionStatus = "idle" | "resolving" | "resolved" | "ambiguous" | "not_found" | "error";

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

function candidateScopeLabel(candidate: Pick<CurriculumCandidate, "school_type" | "orientation" | "speciality">): string {
  const parts = [
    candidate.school_type || "Generico",
    candidate.orientation || null,
    candidate.speciality || null,
  ].filter(Boolean);

  return parts.join(" · ");
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
    return host === "abc.gob.ar" || host === "servicios.abc.gov.ar";
  } catch {
    return false;
  }
}

function isMissingCurriculumColumnError(error: { message?: string } | null | undefined): boolean {
  const message = error?.message || "";
  return message.includes("curriculum_document_id") && message.includes("courses");
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
  orientation: string;
  speciality: string;
  newSchoolName: string;
  newSchoolDistrict: string;
  newSchoolLocality: string;
  newSchoolType: SchoolType;
  creatingNewSchool: boolean;
}

export default function CourseNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryCycle = searchParams.get("cycle");
  const initialCycle = queryCycle === "BASIC" || queryCycle === "UPPER" ? queryCycle : "";
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
    schoolType: "COMUN",
    cycle: initialCycle,
    yearLevel: initialYearLevel,
    subject: searchParams.get("subject") || "",
    orientation: searchParams.get("orientation") || "",
    speciality: searchParams.get("speciality") || "",
    newSchoolName: "",
    newSchoolDistrict: "",
    newSchoolLocality: "",
    newSchoolType: "COMUN",
    creatingNewSchool: false,
  });

  const selectedSchool = schools.find((school) => school.id === state.schoolId);
  const selectedCurriculum =
    curriculumCandidates.find((candidate) => candidate.id === selectedCurriculumId) || null;
  const importProgramUrl = `/curriculum/import?subject=${encodeURIComponent(state.subject || "")}&cycle=${encodeURIComponent(
    state.cycle || ""
  )}&year_level=${encodeURIComponent(state.yearLevel?.toString() || "")}`;
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
  const needsOrientation = useMemo(() => {
    if (!(state.cycle === "UPPER" && state.schoolType === "COMUN")) return false;
    return matchingPrograms.some((program) => !!program.orientation);
  }, [matchingPrograms, state.cycle, state.schoolType]);
  const needsSpeciality = useMemo(() => {
    if (!(state.cycle === "UPPER" && state.schoolType === "TECNICA")) return false;
    return matchingPrograms.some((program) => !!program.speciality);
  }, [matchingPrograms, state.cycle, state.schoolType]);

  const steps = useMemo(() => {
    const base = [
      { num: 1, label: "Provincia" },
      { num: 2, label: "Materia" },
      { num: 3, label: "Escuela" },
      { num: 4, label: "Ciclo" },
      { num: 5, label: "Ano" },
    ];

    if (needsOrientation) base.push({ num: 6, label: "Orientacion" });
    if (needsSpeciality) base.push({ num: 7, label: "Especialidad" });

    base.push({ num: 8, label: "Programa oficial" });
    base.push({ num: 9, label: "Confirmacion" });
    return base;
  }, [needsOrientation, needsSpeciality]);

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
  }, [state.subject, state.cycle, state.yearLevel, state.schoolType, state.orientation, state.speciality]);

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
            speciality: needsSpeciality ? state.speciality : null,
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
        setResolutionError(data?.reason || "No se encontro un programa disponible para esa combinacion.");
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
        return !!state.schoolId;
      case 4:
        return !!state.cycle;
      case 5:
        return !!state.yearLevel;
      case 6:
        return !needsOrientation || !!state.orientation.trim();
      case 7:
        return !needsSpeciality || !!state.speciality.trim();
      case 8:
        return !!selectedCurriculumId && (resolutionStatus === "resolved" || resolutionStatus === "ambiguous");
      default:
        return true;
    }
  };

  const nextStep = () => {
    let next = step + 1;
    if (next === 6 && !needsOrientation) next++;
    if (next === 7 && !needsSpeciality) next++;
    if (next > 9) next = 9;
    setStep(next);
  };

  const prevStep = () => {
    let prev = step - 1;
    if (prev === 7 && !needsSpeciality) prev--;
    if (prev === 6 && !needsOrientation) prev--;
    if (prev < 1) prev = 1;
    setStep(prev);
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
        description: "Resolve y confirma primero el programa oficial del curso.",
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
          title: "Limite alcanzado",
          description: `Alcanzaste el limite de cursos (${limitData.current}/${limitData.max})`,
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
        speciality: needsSpeciality ? state.speciality : null,
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
          description: "El curso se creo, pero el borrador inicial del plan no pudo completarse automaticamente.",
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
                "El curso se creo en una base sin curriculum_document_id. El backend de Lovable Cloud sigue desactualizado.",
            }
          : {
              title: "Curso creado",
              description: "El curso quedo vinculado a su programa oficial y recibio un borrador inicial del plan.",
            }
      );
      navigate(courseDetailUrl(course!.id));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
              Paso {steps.findIndex((item) => item.num === step) + 1} de {steps.length} -{" "}
              {steps.find((item) => item.num === step)?.label}
            </p>
          </div>
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
              {step === 5 && "Ano"}
              {step === 6 && "Orientacion"}
              {step === 7 && "Especialidad"}
              {step === 8 && "Programa oficial"}
              {step === 9 && "Confirmacion"}
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
                      orientation: "",
                      speciality: "",
                    }))
                  }
                  placeholder="Ej: Filosofia, Historia, Matematica..."
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
                            schoolType: school?.school_type || "COMUN",
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Elegi una escuela..." />
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
                          <SelectItem value="COMUN">Comun</SelectItem>
                          <SelectItem value="TECNICA">Tecnica</SelectItem>
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
                      orientation: "",
                      speciality: "",
                    }))
                  }
                >
                  <SelectTrigger>
                        <SelectValue placeholder="Elegi ciclo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCycles.includes("BASIC") && (
                          <SelectItem value="BASIC">Ciclo Basico (1 a 3)</SelectItem>
                        )}
                        {availableCycles.includes("UPPER") && (
                          <SelectItem value="UPPER">Ciclo Superior (4 a 6)</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Selecciona el ciclo para ayudar a resolver el programa oficial correcto.
                    </p>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select
                  value={state.yearLevel?.toString() || ""}
                  onValueChange={(value) =>
                    setState((prev) => ({ ...prev, yearLevel: parseInt(value, 10) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegi ano..." />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year} ano
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecciona el ano para ajustar la resolucion del diseno curricular.
                </p>
              </div>
            )}

            {step === 6 && needsOrientation && (
              <div className="space-y-2">
                <Label>Orientacion</Label>
                <Input
                  value={state.orientation}
                  onChange={(event) =>
                    setState((prev) => ({ ...prev, orientation: event.target.value }))
                  }
                  placeholder="Ej: Ciencias Sociales, Economia y Administracion..."
                />
              </div>
            )}

            {step === 7 && needsSpeciality && (
              <div className="space-y-2">
                <Label>Especialidad</Label>
                <Input
                  value={state.speciality}
                  onChange={(event) =>
                    setState((prev) => ({ ...prev, speciality: event.target.value }))
                  }
                  placeholder="Ej: Electromecanica, Informatica..."
                />
              </div>
            )}

            {step === 8 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Programa oficial</Label>
                  <p className="text-sm text-muted-foreground">
                    Antes de crear el curso resolvemos el diseno curricular oficial para que la planificacion tenga una base curricular explicita.
                  </p>
                </div>

                {resolutionStatus === "resolving" && (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    Buscando y resolviendo el programa oficial correspondiente...
                  </div>
                )}

                {(resolutionStatus === "resolved" || resolutionStatus === "ambiguous") && selectedCurriculum && (
                  <div className="space-y-3 rounded-md border p-4">
                    {resolutionStatus === "ambiguous" && curriculumCandidates.length > 1 && (
                      <div className="space-y-2">
                        <Label>Elegi el documento correcto</Label>
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
                        {selectedCurriculum.is_official_domain ? "Si" : "No verificado"}
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
                        El documento fue resuelto en la base curricular pero todavia no tiene URL oficial registrada.
                      </p>
                    )}
                  </div>
                )}

                {resolutionStatus === "ambiguous" && !selectedCurriculum && curriculumCandidates.length > 0 && (
                  <div className="space-y-3 rounded-md border border-warning/40 bg-warning/5 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Hay mas de un programa posible para esta combinacion.</p>
                      <p className="text-sm text-muted-foreground">
                        Revise el alcance de cada documento y seleccione manualmente el correcto antes de crear el curso.
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
                          <p className="text-xs text-muted-foreground">
                            {candidateScopeLabel(candidate)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Fuente: {candidate.source_provider} · Dominio oficial: {candidate.is_official_domain ? "Si" : "No verificado"}
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
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button asChild size="sm" variant="outline">
                        <Link to={importProgramUrl}>
                          <Upload className="mr-2 h-4 w-4" />
                          Importar programa
                        </Link>
                      </Button>
                    </div>
                    <a
                      href={officialIndexUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 underline underline-offset-4"
                    >
                      Revisar indice oficial de disenos curriculares
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {step === 9 && (
              <div className="space-y-3">
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
                  <span>{state.cycle === "BASIC" ? "Basico" : "Superior"}</span>
                  <span className="text-muted-foreground">Ano:</span>
                  <span>{state.yearLevel}</span>
                  {needsOrientation && (
                    <>
                      <span className="text-muted-foreground">Orientacion:</span>
                      <span>{state.orientation}</span>
                    </>
                  )}
                  {needsSpeciality && (
                    <>
                      <span className="text-muted-foreground">Especialidad:</span>
                      <span>{state.speciality}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Programa oficial:</span>
                  <span>{selectedCurriculum?.display_title || "No resuelto"}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={prevStep} disabled={step === 1}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>
              {step === 9 ? (
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
