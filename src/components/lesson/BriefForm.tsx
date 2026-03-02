import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import BibliographySelector from "./BibliographySelector";

interface BriefFormProps {
  lessonId: string;
  courseId: string;
  brief: any | null;
  onUpdate: () => void;
}

export default function BriefForm({ lessonId, courseId, brief, onUpdate }: BriefFormProps) {
  const [enfoque, setEnfoque] = useState(brief?.enfoque_deseado ?? "");
  const [dinamica, setDinamica] = useState(brief?.tipo_dinamica_sugerida ?? "");
  const [profundidad, setProfundidad] = useState<"BAJO" | "MEDIO" | "ALTO">(brief?.nivel_profundidad ?? "MEDIO");
  const [observaciones, setObservaciones] = useState(brief?.observaciones_docente ?? "");
  const [bibliografia, setBibliografia] = useState<string[]>(brief?.bibliografia_confirmada ?? []);
  const [saving, setSaving] = useState(false);

  const initialState = useMemo(() => ({
    enfoque: brief?.enfoque_deseado ?? "",
    dinamica: brief?.tipo_dinamica_sugerida ?? "",
    profundidad: brief?.nivel_profundidad ?? "MEDIO",
    observaciones: brief?.observaciones_docente ?? "",
    bibliografia: brief?.bibliografia_confirmada ?? [],
  }), [brief]);

  const isDirty = enfoque !== initialState.enfoque ||
    dinamica !== initialState.dinamica ||
    profundidad !== initialState.profundidad ||
    observaciones !== initialState.observaciones ||
    JSON.stringify(bibliografia) !== JSON.stringify(initialState.bibliografia);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const isConfirmed = brief?.status === "READY_FOR_PRODUCTION" || brief?.status === "PRODUCED";

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        lesson_id: lessonId,
        enfoque_deseado: enfoque,
        tipo_dinamica_sugerida: dinamica,
        nivel_profundidad: profundidad,
        observaciones_docente: observaciones,
        bibliografia_confirmada: bibliografia,
      };

      if (brief) {
        await supabase
          .from("lesson_briefs")
          .update(payload)
          .eq("id", brief.id);
      } else {
        await supabase.from("lesson_briefs").insert([payload]);
      }

      toast({ title: "Relevamiento guardado" });
      onUpdate();
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleConfirm = async () => {
    if (bibliografia.length === 0) {
      toast({ title: "Seleccioná al menos una fuente bibliográfica", variant: "destructive" });
      return;
    }
    if (bibliografia.length > 5) {
      toast({ title: "Máximo 5 fuentes bibliográficas", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Save first
      const payload = {
        lesson_id: lessonId,
        enfoque_deseado: enfoque,
        tipo_dinamica_sugerida: dinamica,
        nivel_profundidad: profundidad,
        observaciones_docente: observaciones,
        bibliografia_confirmada: bibliografia,
        status: "READY_FOR_PRODUCTION" as const,
      };

      if (brief) {
        await supabase.from("lesson_briefs").update(payload).eq("id", brief.id);
      } else {
        await supabase.from("lesson_briefs").insert([payload]);
      }

      toast({ title: "Relevamiento confirmado" });
      onUpdate();
    } catch {
      toast({ title: "Error al confirmar", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Enfoque deseado</Label>
        <Textarea
          value={enfoque}
          onChange={(e) => setEnfoque(e.target.value)}
          placeholder="¿Qué enfoque querés darle a esta clase?"
          disabled={isConfirmed}
        />
      </div>

      <div className="space-y-2">
        <Label>Tipo de dinámica sugerida</Label>
        <Textarea
          value={dinamica}
          onChange={(e) => setDinamica(e.target.value)}
          placeholder="Ej: debate, trabajo en grupos, exposición..."
          disabled={isConfirmed}
        />
      </div>

      <div className="space-y-2">
        <Label>Nivel de profundidad</Label>
        <Select value={profundidad} onValueChange={(v) => setProfundidad(v as "BAJO" | "MEDIO" | "ALTO")} disabled={isConfirmed}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BAJO">Bajo</SelectItem>
            <SelectItem value="MEDIO">Medio</SelectItem>
            <SelectItem value="ALTO">Alto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Observaciones</Label>
        <Textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Observaciones adicionales para el motor IA..."
          disabled={isConfirmed}
        />
      </div>

      <BibliographySelector
        courseId={courseId}
        selected={bibliografia}
        onChange={setBibliografia}
        disabled={isConfirmed}
      />

      {!isConfirmed && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            Guardar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || bibliografia.length === 0}>
            Confirmar relevamiento
          </Button>
        </div>
      )}
    </div>
  );
}
