import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { X, Plus, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import PlanObjectivesEditor from "./PlanObjectivesEditor";
import PlanLessonsEditor from "./PlanLessonsEditor";
import { InlineValidationSummary } from "@/components/ui/InlineValidationSummary";

interface PlanData {
  fundamentacion: string;
  estrategias_marco: string;
  estrategias_practicas: string[];
  evaluacion_marco: string;
  resources: string;
}

interface Props {
  planId: string;
  courseId: string;
  curriculumDocumentId?: string | null;
  planStatus: string;
  onValidated: () => void;
  courseArchived?: boolean;
}

function buildRepairGuidance(errors: string[]) {
  const steps: string[] = [];
  const lessonIssues = new Map<number, string[]>();

  for (const error of errors) {
    if (error.includes("Fundamentacion")) {
      steps.push("Revise la pestana Fundamentacion y extienda el marco del plan hasta dejar una base anual util.");
      continue;
    }
    if (error.includes("Estrategias marco") || error.includes("estrategia practica")) {
      steps.push("Revise la pestana Estrategias y complete tanto el enfoque general como al menos una estrategia practica.");
      continue;
    }
    if (error.includes("Evaluacion marco")) {
      steps.push("Revise la pestana Evaluacion y explicite como se seguira y recuperara el trabajo del curso.");
      continue;
    }
    if (error.includes("Recursos")) {
      steps.push("Revise la pestana Recursos y complete los soportes, materiales y alternativas low-tech del plan.");
      continue;
    }
    if (error.includes("propositos")) {
      steps.push("Revise la pestana Propositos y deje entre 4 y 8 objetivos observables.");
      continue;
    }
    if (error.includes("contenido curricular mapeado")) {
      steps.push("La base curricular no quedo bien enlazada: rearme el borrador curricular o revise el programa asociado al curso.");
      continue;
    }
    if (error.includes("Ya existen lecciones para este curso")) {
      steps.push("El curso ya tiene lecciones creadas. Si hubo cambios fuertes, use la revalidacion o rearme el borrador en lugar de validar como plan nuevo.");
      continue;
    }

    const lessonMatch = error.match(/^Clase\s+(\d+):\s+(.*)$/i);
    if (lessonMatch) {
      const lessonNumber = Number(lessonMatch[1]);
      const issue = lessonMatch[2];
      const current = lessonIssues.get(lessonNumber) || [];
      current.push(issue);
      lessonIssues.set(lessonNumber, current);
    }
  }

  const lessonRepairs = Array.from(lessonIssues.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([lessonNumber, issues]) => {
      const normalizedIssues = issues.map((issue) => issue.replace(" es obligatorio", "").trim().toLowerCase());
      return `Clase ${lessonNumber}: revise ${normalizedIssues.join(", ")} en la pestana Clases.`;
    });

  return Array.from(new Set([...steps, ...lessonRepairs]));
}

export default function PlanEditor({
  planId,
  courseId,
  curriculumDocumentId,
  planStatus,
  onValidated,
  courseArchived,
}: Props) {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [newStrategy, setNewStrategy] = useState("");
  const [currentStatus, setCurrentStatus] = useState(planStatus);
  const [hasEditedAfterValidation, setHasEditedAfterValidation] = useState(false);
  const transitioningRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readOnly = !!courseArchived;
  const repairGuidance = buildRepairGuidance(validationErrors);

  useEffect(() => {
    setCurrentStatus(planStatus);
    setHasEditedAfterValidation(planStatus === "EDITED");
  }, [planStatus]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("plans")
        .select("fundamentacion, estrategias_marco, estrategias_practicas, evaluacion_marco, resources")
        .eq("id", planId)
        .single();

      if (data) setPlan(data);
      setLoading(false);
    };

    fetch();
  }, [planId]);

  const transitionToEdited = useCallback(async () => {
    if (transitioningRef.current || readOnly) return;
    if (currentStatus !== "VALIDATED") return;

    transitioningRef.current = true;
    await supabase.from("plans").update({ status: "EDITED" as any }).eq("id", planId);
    setCurrentStatus("EDITED");
    setHasEditedAfterValidation(true);
    transitioningRef.current = false;
  }, [currentStatus, planId, readOnly]);

  const saveField = useCallback(
    (field: keyof PlanData, value: string | string[]) => {
      if (readOnly) return;

      setValidationErrors([]);
      if (saveTimer.current) clearTimeout(saveTimer.current);

      saveTimer.current = setTimeout(async () => {
        if (currentStatus === "VALIDATED") {
          await transitionToEdited();
        }

        await supabase.from("plans").update({ [field]: value }).eq("id", planId);
      }, 500);
    },
    [currentStatus, planId, readOnly, transitionToEdited]
  );

  const updateField = (field: keyof PlanData, value: string) => {
    setPlan((prev) => (prev ? { ...prev, [field]: value } : prev));
    saveField(field, value);
  };

  const addStrategy = () => {
    if (!newStrategy.trim() || !plan) return;
    const updated = [...plan.estrategias_practicas, newStrategy.trim()];
    setPlan({ ...plan, estrategias_practicas: updated });
    setNewStrategy("");
    saveField("estrategias_practicas", updated);
  };

  const removeStrategy = (idx: number) => {
    if (!plan) return;
    const updated = plan.estrategias_practicas.filter((_, i) => i !== idx);
    setPlan({ ...plan, estrategias_practicas: updated });
    saveField("estrategias_practicas", updated);
  };

  const handleRebuildPlan = async () => {
    if (!curriculumDocumentId) {
      toast({
        title: "Falta base curricular",
        description: "Este curso no tiene un documento curricular persistido para rearmar el borrador.",
        variant: "destructive",
      });
      return;
    }

    setBootstrapping(true);
    setValidationErrors([]);

    try {
      const { data, error } = await supabase.functions.invoke("bootstrap-course-plan", {
        body: {
          course_id: courseId,
          plan_id: planId,
          curriculum_document_id: curriculumDocumentId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { data: refreshedPlan } = await supabase
        .from("plans")
        .select("fundamentacion, estrategias_marco, estrategias_practicas, evaluacion_marco, resources")
        .eq("id", planId)
        .single();

      if (refreshedPlan) setPlan(refreshedPlan);

      const nextStatus =
        data?.plan_status === "EDITED" || data?.plan_status === "VALIDATED" ? data.plan_status : "INCOMPLETE";
      setCurrentStatus(nextStatus);
      setHasEditedAfterValidation(nextStatus === "EDITED");

      toast({
        title: "Borrador reconstruido",
        description: data?.synthetic_nodes_created
          ? "Se regenero el plan y se creo una estructura curricular minima porque el documento aun no tenia nodos procesados."
          : "Se regenero la base anual del plan a partir del programa oficial del curso.",
      });
      onValidated();
    } catch (err: any) {
      toast({
        title: "No se pudo reconstruir el borrador",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBootstrapping(false);
    }
  };

  const handleValidate = async () => {
    if (!plan) return;

    setValidating(true);
    setValidationErrors([]);

    try {
      const { data, error } = await supabase.rpc("validate_plan", { p_plan_id: planId });
      if (error) throw error;

      const result = data as unknown as { success: boolean; errors: string[] };
      if (!result.success) {
        setValidationErrors(result.errors);
        toast({
          title: "Validacion fallida",
          description: result.errors.join(". "),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: hasEditedAfterValidation ? "Plan revalidado" : "Plan validado",
        description: hasEditedAfterValidation
          ? "Los cambios fueron validados correctamente."
          : "Se crearon las lecciones del curso.",
      });
      onValidated();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

  const renderStatusBadge = () => {
    switch (currentStatus) {
      case "VALIDATED":
        return <Badge variant="default">Validado</Badge>;
      case "EDITED":
        return (
          <div className="flex items-center gap-2">
            <Badge variant="destructive">Editado</Badge>
            <span className="text-xs text-muted-foreground">Requiere revalidacion</span>
          </div>
        );
      default:
        return <Badge variant="secondary">Incompleto</Badge>;
    }
  };

  const ctaLabel = currentStatus === "EDITED" ? "Validar cambios" : "Validar plan";
  const showCta = !readOnly && !courseArchived && currentStatus !== "VALIDATED";

  if (loading || !plan) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Cargando plan...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Planificacion anual</CardTitle>
        {renderStatusBadge()}
      </CardHeader>
      <CardContent className="space-y-4">
        <InlineValidationSummary errors={validationErrors} />
        {repairGuidance.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-warning">
              <ShieldCheck className="h-4 w-4" />
              Reparacion sugerida
            </div>
            <div className="space-y-1 text-sm text-foreground">
              {repairGuidance.map((step, index) => (
                <p key={`${step}-${index}`}>{step}</p>
              ))}
            </div>
          </div>
        )}

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleRebuildPlan}
              disabled={bootstrapping || !curriculumDocumentId}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {bootstrapping ? "Reconstruyendo..." : "Rearmar borrador curricular"}
            </Button>
          </div>
        )}

        <Tabs defaultValue="fundamentacion">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="fundamentacion">Fundamentacion</TabsTrigger>
            <TabsTrigger value="estrategias">Estrategias</TabsTrigger>
            <TabsTrigger value="evaluacion">Evaluacion</TabsTrigger>
            <TabsTrigger value="recursos">Recursos</TabsTrigger>
            <TabsTrigger value="propositos">Propositos</TabsTrigger>
            <TabsTrigger value="clases">Clases</TabsTrigger>
          </TabsList>

          <TabsContent value="fundamentacion" className="space-y-2 pt-2">
            <Label>Fundamentacion</Label>
            <Textarea
              value={plan.fundamentacion}
              onChange={(e) => updateField("fundamentacion", e.target.value)}
              placeholder="Escribir la fundamentacion del plan..."
              rows={6}
              disabled={readOnly}
            />
            <p className="text-xs text-muted-foreground">{plan.fundamentacion.length} caracteres</p>
          </TabsContent>

          <TabsContent value="estrategias" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Estrategias marco</Label>
              <Textarea
                value={plan.estrategias_marco}
                onChange={(e) => updateField("estrategias_marco", e.target.value)}
                placeholder="Describir las estrategias generales..."
                rows={4}
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label>Estrategias practicas</Label>
              <div className="flex flex-wrap gap-2">
                {plan.estrategias_practicas.map((strategy, index) => (
                  <Badge key={index} variant="secondary" className="gap-1 px-2 py-1">
                    {strategy}
                    {!readOnly && (
                      <button type="button" onClick={() => removeStrategy(index)} className="ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
              {!readOnly && (
                <div className="flex gap-2">
                  <Input
                    value={newStrategy}
                    onChange={(e) => setNewStrategy(e.target.value)}
                    placeholder="Nueva estrategia..."
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStrategy())}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addStrategy}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="evaluacion" className="space-y-2 pt-2">
            <Label>Evaluacion marco</Label>
            <Textarea
              value={plan.evaluacion_marco}
              onChange={(e) => updateField("evaluacion_marco", e.target.value)}
              placeholder="Describir el marco de evaluacion..."
              rows={6}
              disabled={readOnly}
            />
          </TabsContent>

          <TabsContent value="recursos" className="space-y-2 pt-2">
            <Label>Recursos</Label>
            <Textarea
              value={plan.resources}
              onChange={(e) => updateField("resources", e.target.value)}
              placeholder="Describir materiales, soportes y alternativas low-tech..."
              rows={5}
              disabled={readOnly}
            />
          </TabsContent>

          <TabsContent value="propositos" className="pt-2">
            <PlanObjectivesEditor planId={planId} readOnly={readOnly} onDirty={transitionToEdited} />
          </TabsContent>

          <TabsContent value="clases" className="pt-2">
            <PlanLessonsEditor planId={planId} readOnly={readOnly} onDirty={transitionToEdited} />
          </TabsContent>
        </Tabs>

        {showCta && (
          <Button onClick={handleValidate} disabled={validating} className="mt-4 w-full">
            <ShieldCheck className="mr-2 h-4 w-4" />
            {validating ? "Validando..." : ctaLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
