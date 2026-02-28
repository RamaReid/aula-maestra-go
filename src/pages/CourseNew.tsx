import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type SchoolType = "COMUN" | "TECNICA";
type Cycle = "BASIC" | "UPPER";

interface SchoolOption {
  id: string;
  official_name: string;
  school_type: SchoolType;
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
  // New school form
  newSchoolName: string;
  newSchoolDistrict: string;
  newSchoolLocality: string;
  newSchoolType: SchoolType;
  creatingNewSchool: boolean;
}

export default function CourseNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState("");
  const [creating, setCreating] = useState(false);

  const [state, setState] = useState<WizardState>({
    province: "PBA",
    schoolId: "",
    schoolType: "COMUN",
    cycle: "",
    yearLevel: null,
    subject: "",
    orientation: "",
    speciality: "",
    newSchoolName: "",
    newSchoolDistrict: "",
    newSchoolLocality: "",
    newSchoolType: "COMUN",
    creatingNewSchool: false,
  });

  // Determine which steps to show
  const needsOrientation = state.cycle === "UPPER" && state.schoolType === "COMUN";
  const needsSpeciality = state.cycle === "UPPER" && state.schoolType === "TECNICA";

  const getSteps = () => {
    const steps = [
      { num: 1, label: "Provincia" },
      { num: 2, label: "Escuela" },
      { num: 3, label: "Ciclo" },
      { num: 4, label: "Año" },
      { num: 5, label: "Materia" },
    ];
    if (needsOrientation) steps.push({ num: 6, label: "Orientación" });
    if (needsSpeciality) steps.push({ num: 7, label: "Especialidad" });
    steps.push({ num: 8, label: "Confirmación" });
    return steps;
  };

  const totalSteps = getSteps();

  // Fetch schools
  useEffect(() => {
    supabase.from("schools").select("id, official_name, school_type").order("official_name").then(({ data }) => {
      if (data) setSchools(data as SchoolOption[]);
    });
  }, []);

  // Fetch subjects when cycle + yearLevel change
  useEffect(() => {
    if (!state.cycle || !state.yearLevel) return;
    supabase
      .from("curriculum_documents")
      .select("subject")
      .eq("cycle", state.cycle)
      .eq("year_level", state.yearLevel)
      .eq("status", "VERIFIED")
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((d) => d.subject))].sort();
          setSubjects(unique);
        }
      });
  }, [state.cycle, state.yearLevel]);

  const yearOptions = state.cycle === "BASIC" ? [1, 2, 3] : state.cycle === "UPPER" ? [4, 5, 6] : [];

  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return true;
      case 2: return !!state.schoolId;
      case 3: return !!state.cycle;
      case 4: return !!state.yearLevel;
      case 5: return !!(state.subject || customSubject.trim());
      case 6: return !needsOrientation || !!state.orientation.trim();
      case 7: return !needsSpeciality || !!state.speciality.trim();
      default: return true;
    }
  };

  const nextStep = () => {
    let next = step + 1;
    // Auto-skip orientation if not needed
    if (next === 6 && !needsOrientation) next++;
    // Auto-skip speciality if not needed
    if (next === 7 && !needsSpeciality) next++;
    // Clamp to confirmation (8)
    if (next > 8) next = 8;
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
      setState((s) => ({
        ...s,
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
    setCreating(true);
    try {
      // Check limit
      const { data: limitData, error: limitError } = await supabase.functions.invoke("check-course-limit");
      if (limitError) throw limitError;
      if (!limitData.can_create) {
        toast({
          title: "Límite alcanzado",
          description: `Alcanzaste el límite de cursos (${limitData.current}/${limitData.max})`,
          variant: "destructive",
        });
        return;
      }

      const finalSubject = state.subject || customSubject.trim();

      // Create course
      const { data: course, error: courseErr } = await supabase
        .from("courses")
        .insert({
          user_id: user.id,
          school_id: state.schoolId,
          subject: finalSubject,
          year_level: state.yearLevel!,
          academic_year: new Date().getFullYear(),
          orientation: needsOrientation ? state.orientation : null,
          speciality: needsSpeciality ? state.speciality : null,
        })
        .select("id")
        .single();
      if (courseErr) throw courseErr;

      // Create plan
      const { data: plan, error: planErr } = await supabase
        .from("plans")
        .insert({ course_id: course!.id })
        .select("id")
        .single();
      if (planErr) throw planErr;

      // Create 28 plan_lessons
      const planLessons = Array.from({ length: 28 }, (_, i) => ({
        plan_id: plan!.id,
        lesson_number: i + 1,
        term: i < 14 ? 1 : 2,
      }));
      const { error: plErr } = await supabase.from("plan_lessons").insert(planLessons);
      if (plErr) throw plErr;

      toast({ title: "Curso creado", description: "Ya podés completar la planificación." });
      navigate(`/course/${course!.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const selectedSchool = schools.find((s) => s.id === state.schoolId);

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
              Paso {totalSteps.findIndex((s) => s.num === step) + 1} de {totalSteps.length} — {totalSteps.find((s) => s.num === step)?.label}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {step === 1 && "Provincia"}
              {step === 2 && "Escuela"}
              {step === 3 && "Ciclo"}
              {step === 4 && "Año"}
              {step === 5 && "Materia"}
              {step === 6 && "Orientación"}
              {step === 7 && "Especialidad"}
              {step === 8 && "Confirmación"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Province */}
            {step === 1 && (
              <div className="space-y-2">
                <Label>Provincia</Label>
                <Input value="Provincia de Buenos Aires" disabled />
                <p className="text-xs text-muted-foreground">Actualmente solo PBA está disponible.</p>
              </div>
            )}

            {/* Step 2: School */}
            {step === 2 && (
              <div className="space-y-4">
                {!state.creatingNewSchool ? (
                  <>
                    <div className="space-y-2">
                      <Label>Seleccionar escuela</Label>
                      <Select
                        value={state.schoolId}
                        onValueChange={(val) => {
                          const school = schools.find((s) => s.id === val);
                          setState((s) => ({
                            ...s,
                            schoolId: val,
                            schoolType: school?.school_type || "COMUN",
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Elegí una escuela..." />
                        </SelectTrigger>
                        <SelectContent>
                          {schools.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.official_name} ({s.school_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setState((s) => ({ ...s, creatingNewSchool: true }))}>
                      + Crear nueva escuela
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3 border rounded-md p-4">
                    <p className="text-sm font-medium">Nueva escuela</p>
                    <div className="space-y-2">
                      <Label>Nombre oficial</Label>
                      <Input
                        value={state.newSchoolName}
                        onChange={(e) => setState((s) => ({ ...s, newSchoolName: e.target.value }))}
                        placeholder="Ej: E.E.S. N° 5"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Distrito</Label>
                        <Input
                          value={state.newSchoolDistrict}
                          onChange={(e) => setState((s) => ({ ...s, newSchoolDistrict: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Localidad</Label>
                        <Input
                          value={state.newSchoolLocality}
                          onChange={(e) => setState((s) => ({ ...s, newSchoolLocality: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select
                        value={state.newSchoolType}
                        onValueChange={(val) => setState((s) => ({ ...s, newSchoolType: val as SchoolType }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="COMUN">Común</SelectItem>
                          <SelectItem value="TECNICA">Técnica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCreateSchool} disabled={!state.newSchoolName.trim()}>
                        Crear
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setState((s) => ({ ...s, creatingNewSchool: false }))}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Cycle */}
            {step === 3 && (
              <div className="space-y-2">
                <Label>Ciclo</Label>
                <Select
                  value={state.cycle}
                  onValueChange={(val) =>
                    setState((s) => ({ ...s, cycle: val as Cycle, yearLevel: null, subject: "", orientation: "", speciality: "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí ciclo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASIC">Ciclo Básico (1°–3°)</SelectItem>
                    <SelectItem value="UPPER">Ciclo Superior (4°–6°)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Step 4: Year */}
            {step === 4 && (
              <div className="space-y-2">
                <Label>Año</Label>
                <Select
                  value={state.yearLevel?.toString() || ""}
                  onValueChange={(val) => setState((s) => ({ ...s, yearLevel: parseInt(val), subject: "" }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí año..." />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}° año
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Step 5: Subject */}
            {step === 5 && (
              <div className="space-y-3">
                <Label>Materia</Label>
                {subjects.length > 0 ? (
                  <>
                    <Select value={state.subject} onValueChange={(val) => { setState((s) => ({ ...s, subject: val })); setCustomSubject(""); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Elegí materia del diseño curricular..." />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">O escribí una materia personalizada:</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No se encontraron materias en el diseño curricular. Escribí el nombre:</p>
                )}
                <Input
                  value={customSubject}
                  onChange={(e) => { setCustomSubject(e.target.value); setState((s) => ({ ...s, subject: "" })); }}
                  placeholder="Materia personalizada..."
                />
              </div>
            )}

            {/* Step 6: Orientation */}
            {step === 6 && needsOrientation && (
              <div className="space-y-2">
                <Label>Orientación</Label>
                <Input
                  value={state.orientation}
                  onChange={(e) => setState((s) => ({ ...s, orientation: e.target.value }))}
                  placeholder="Ej: Ciencias Sociales, Economía y Administración..."
                />
              </div>
            )}

            {/* Step 7: Speciality */}
            {step === 7 && needsSpeciality && (
              <div className="space-y-2">
                <Label>Especialidad</Label>
                <Input
                  value={state.speciality}
                  onChange={(e) => setState((s) => ({ ...s, speciality: e.target.value }))}
                  placeholder="Ej: Electromecánica, Informática..."
                />
              </div>
            )}

            {/* Step 8: Confirmation */}
            {step === 8 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Provincia:</span>
                  <span>PBA</span>
                  <span className="text-muted-foreground">Escuela:</span>
                  <span>{selectedSchool?.official_name || "—"}</span>
                  <span className="text-muted-foreground">Tipo:</span>
                  <span>{state.schoolType}</span>
                  <span className="text-muted-foreground">Ciclo:</span>
                  <span>{state.cycle === "BASIC" ? "Básico" : "Superior"}</span>
                  <span className="text-muted-foreground">Año:</span>
                  <span>{state.yearLevel}°</span>
                  <span className="text-muted-foreground">Materia:</span>
                  <span>{state.subject || customSubject}</span>
                  {needsOrientation && (
                    <>
                      <span className="text-muted-foreground">Orientación:</span>
                      <span>{state.orientation}</span>
                    </>
                  )}
                  {needsSpeciality && (
                    <>
                      <span className="text-muted-foreground">Especialidad:</span>
                      <span>{state.speciality}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Navigation */}
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
