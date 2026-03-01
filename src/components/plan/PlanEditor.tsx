import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { X, Plus, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import PlanObjectivesEditor from "./PlanObjectivesEditor";
import { InlineValidationSummary } from "@/components/ui/InlineValidationSummary";

interface PlanData {
  fundamentacion: string;
  estrategias_marco: string;
  estrategias_practicas: string[];
  evaluacion_marco: string;
}

interface Props {
  planId: string;
  courseId: string;
  planStatus: string;
  onValidated: () => void;
  courseArchived?: boolean;
}

export default function PlanEditor({ planId, courseId, planStatus, onValidated, courseArchived }: Props) {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [newStrategy, setNewStrategy] = useState("");
  const readOnly = planStatus === "VALIDATED" || !!courseArchived;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("plans")
        .select("fundamentacion, estrategias_marco, estrategias_practicas, evaluacion_marco")
        .eq("id", planId)
        .single();
      if (data) setPlan(data);
      setLoading(false);
    };
    fetch();
  }, [planId]);

  const saveField = useCallback(
    (field: keyof PlanData, value: string | string[]) => {
      if (readOnly) return;
      setValidationErrors([]);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await supabase.from("plans").update({ [field]: value }).eq("id", planId);
      }, 500);
    },
    [planId, readOnly]
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
        toast({ title: "Validación fallida", description: result.errors.join(". "), variant: "destructive" });
        return;
      }
      toast({ title: "Plan validado", description: "Se crearon las lecciones del curso." });
      onValidated();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

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
        <CardTitle className="text-lg">Planificación Anual</CardTitle>
        <Badge variant={readOnly ? "default" : "secondary"}>
          {readOnly ? "Validado" : "Incompleto"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <InlineValidationSummary errors={validationErrors} />

        <Tabs defaultValue="fundamentacion">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="fundamentacion">Fundamentación</TabsTrigger>
            <TabsTrigger value="estrategias">Estrategias</TabsTrigger>
            <TabsTrigger value="evaluacion">Evaluación</TabsTrigger>
            <TabsTrigger value="propositos">Propósitos</TabsTrigger>
          </TabsList>

          <TabsContent value="fundamentacion" className="space-y-2 pt-2">
            <Label>Fundamentación</Label>
            <Textarea
              value={plan.fundamentacion}
              onChange={(e) => updateField("fundamentacion", e.target.value)}
              placeholder="Escribir la fundamentación del plan (mínimo 100 caracteres)..."
              rows={6}
              disabled={readOnly}
            />
            <p className="text-xs text-muted-foreground">{plan.fundamentacion.length} caracteres</p>
          </TabsContent>

          <TabsContent value="estrategias" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Estrategias Marco</Label>
              <Textarea
                value={plan.estrategias_marco}
                onChange={(e) => updateField("estrategias_marco", e.target.value)}
                placeholder="Describir las estrategias generales..."
                rows={4}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Estrategias Prácticas</Label>
              <div className="flex flex-wrap gap-2">
                {plan.estrategias_practicas.map((s, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 py-1 px-2">
                    {s}
                    {!readOnly && (
                      <button onClick={() => removeStrategy(i)} className="ml-1">
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
                  <Button variant="outline" size="sm" onClick={addStrategy}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="evaluacion" className="space-y-2 pt-2">
            <Label>Evaluación Marco</Label>
            <Textarea
              value={plan.evaluacion_marco}
              onChange={(e) => updateField("evaluacion_marco", e.target.value)}
              placeholder="Describir el marco de evaluación..."
              rows={6}
              disabled={readOnly}
            />
          </TabsContent>

          <TabsContent value="propositos" className="pt-2">
            <PlanObjectivesEditor planId={planId} readOnly={readOnly} />
          </TabsContent>
        </Tabs>

        {!readOnly && !courseArchived && (
          <Button onClick={handleValidate} disabled={validating} className="w-full mt-4">
            <ShieldCheck className="h-4 w-4 mr-2" />
            {validating ? "Validando..." : "Validar Plan"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
