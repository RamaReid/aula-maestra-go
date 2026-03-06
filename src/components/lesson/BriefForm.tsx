import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import BibliographySelector from "./BibliographySelector";
import type { PlanType } from "@/hooks/useEntitlements";

interface BriefFormProps {
  lessonId: string;
  courseId: string;
  brief: any | null;
  onUpdate: () => void;
  planType: PlanType;
}

const MAX_SOURCES = 5;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx", "txt"]);

function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  if (parts.length < 2) return "";
  return parts.pop()!.toLowerCase().trim();
}

function mapMediaType(extension: string): "PDF" | "IMAGE" | "DOC" | "SHEET" | "TEXT" {
  if (extension === "pdf") return "PDF";
  if (extension === "jpg" || extension === "jpeg" || extension === "png") return "IMAGE";
  if (extension === "doc" || extension === "docx") return "DOC";
  if (extension === "xls" || extension === "xlsx") return "SHEET";
  return "TEXT";
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export default function BriefForm({ lessonId, courseId, brief, onUpdate, planType }: BriefFormProps) {
  const [enfoque, setEnfoque] = useState(brief?.enfoque_deseado ?? "");
  const [dinamica, setDinamica] = useState(brief?.tipo_dinamica_sugerida ?? "");
  const [profundidad, setProfundidad] = useState<"BAJO" | "MEDIO" | "ALTO">(brief?.nivel_profundidad ?? "MEDIO");
  const [observaciones, setObservaciones] = useState(brief?.observaciones_docente ?? "");
  const [bibliografia, setBibliografia] = useState<string[]>(brief?.bibliografia_confirmada ?? []);
  const [authorizedSources, setAuthorizedSources] = useState<string[]>(brief?.authorized_source_ids ?? []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const initialState = useMemo(
    () => ({
      enfoque: brief?.enfoque_deseado ?? "",
      dinamica: brief?.tipo_dinamica_sugerida ?? "",
      profundidad: brief?.nivel_profundidad ?? "MEDIO",
      observaciones: brief?.observaciones_docente ?? "",
      bibliografia: brief?.bibliografia_confirmada ?? [],
      authorizedSources: brief?.authorized_source_ids ?? [],
    }),
    [brief]
  );

  const totalSelectedSources = bibliografia.length + authorizedSources.length;

  const isDirty =
    enfoque !== initialState.enfoque ||
    dinamica !== initialState.dinamica ||
    profundidad !== initialState.profundidad ||
    observaciones !== initialState.observaciones ||
    JSON.stringify(bibliografia) !== JSON.stringify(initialState.bibliografia) ||
    JSON.stringify(authorizedSources) !== JSON.stringify(initialState.authorizedSources);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const isConfirmed = brief?.status === "READY_FOR_PRODUCTION" || brief?.status === "PRODUCED";
  const canUploadTeacherSources = planType === "BASICO" || planType === "PREMIUM";

  const buildPayload = (status?: "IN_PROGRESS" | "READY_FOR_PRODUCTION" | "PRODUCED") => ({
    lesson_id: lessonId,
    enfoque_deseado: enfoque,
    tipo_dinamica_sugerida: dinamica,
    nivel_profundidad: profundidad,
    observaciones_docente: observaciones,
    bibliografia_confirmada: bibliografia,
    authorized_source_ids: authorizedSources,
    ...(status ? { status } : {}),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();

      if (brief) {
        await supabase.from("lesson_briefs").update(payload as any).eq("id", brief.id);
      } else {
        await supabase.from("lesson_briefs").insert([payload] as any);
      }

      toast({ title: "Relevamiento guardado" });
      onUpdate();
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleConfirm = async () => {
    if (totalSelectedSources === 0) {
      toast({ title: "Selecciona al menos una fuente", variant: "destructive" });
      return;
    }
    if (totalSelectedSources > MAX_SOURCES) {
      toast({ title: `Maximo ${MAX_SOURCES} fuentes en total`, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload("READY_FOR_PRODUCTION");

      if (brief) {
        await supabase.from("lesson_briefs").update(payload as any).eq("id", brief.id);
      } else {
        await supabase.from("lesson_briefs").insert([payload] as any);
      }

      toast({ title: "Relevamiento confirmado" });
      onUpdate();
    } catch {
      toast({ title: "Error al confirmar", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleUploadSources = async () => {
    if (!canUploadTeacherSources) {
      toast({ title: "Tu plan no permite cargar fuentes del docente", variant: "destructive" });
      return;
    }
    if (selectedFiles.length === 0) {
      toast({ title: "Selecciona al menos un archivo", variant: "destructive" });
      return;
    }
    if (selectedFiles.length > MAX_SOURCES) {
      toast({ title: `Maximo ${MAX_SOURCES} archivos por carga`, variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const createdSourceIds: string[] = [];
      let processedCount = 0;

      for (const file of selectedFiles) {
        const extension = getFileExtension(file.name);
        if (!ALLOWED_EXTENSIONS.has(extension)) {
          continue;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          continue;
        }

        const safeName = sanitizeFileName(file.name);
        const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const filePath = `${courseId}/${lessonId}/${uniquePrefix}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("authorized-sources")
          .upload(filePath, file, { upsert: false, contentType: file.type || undefined });
        if (uploadError) {
          continue;
        }

        let extractedText: string | null = null;
        if (extension === "txt") {
          try {
            const raw = await file.text();
            extractedText = raw.slice(0, 20000);
          } catch {
            extractedText = null;
          }
        }

        const sourcePayload = {
          course_id: courseId,
          origin_type: "DOCENTE_ARCHIVO",
          plan_scope: planType,
          media_type: mapMediaType(extension),
          title: file.name,
          storage_path: filePath,
          mime_type: file.type || null,
          status: "PROCESSED",
          extracted_text: extractedText,
          summary_text: extractedText
            ? extractedText.slice(0, 600)
            : "Fuente de docente cargada por archivo. Sin extraccion textual automatica en esta etapa.",
        };

        const { data: createdSource, error: sourceError } = await supabase
          .from("authorized_sources" as any)
          .insert(sourcePayload)
          .select("id")
          .single();
        if (sourceError || !createdSource?.id) {
          continue;
        }

        const { error: targetError } = await supabase.from("authorized_source_targets" as any).insert({
          source_id: createdSource.id,
          target_type: "LESSON",
          lesson_id: lessonId,
        });
        if (targetError) {
          continue;
        }

        processedCount += 1;
        createdSourceIds.push(createdSource.id as string);
      }

      if (createdSourceIds.length > 0) {
        setAuthorizedSources((prev) => Array.from(new Set([...prev, ...createdSourceIds])));
      }
      setSelectedFiles([]);
      if (processedCount > 0) {
        toast({ title: `Fuentes cargadas: ${processedCount}` });
      } else {
        toast({
          title: "No se pudo procesar la carga",
          description: "Revisa formatos permitidos y tamano maximo (20 MB).",
          variant: "destructive",
        });
      }
      onUpdate();
    } catch {
      toast({ title: "Error al cargar fuentes", variant: "destructive" });
    }
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Enfoque deseado</Label>
        <Textarea
          value={enfoque}
          onChange={(e) => setEnfoque(e.target.value)}
          placeholder="Que enfoque quieres darle a esta clase?"
          disabled={isConfirmed}
        />
      </div>

      <div className="space-y-2">
        <Label>Tipo de dinamica sugerida</Label>
        <Textarea
          value={dinamica}
          onChange={(e) => setDinamica(e.target.value)}
          placeholder="Ej: debate, trabajo en grupos, exposicion..."
          disabled={isConfirmed}
        />
      </div>

      <div className="space-y-2">
        <Label>Nivel de profundidad</Label>
        <Select
          value={profundidad}
          onValueChange={(v) => setProfundidad(v as "BAJO" | "MEDIO" | "ALTO")}
          disabled={isConfirmed}
        >
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

      {canUploadTeacherSources && !isConfirmed && (
        <div className="space-y-2 rounded-md border p-3">
          <Label>Fuentes del docente (archivo)</Label>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt"
            onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
            className="block w-full text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Formatos: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX, TXT. Maximo 5 archivos por carga, 20 MB por archivo.
          </p>
          <Button type="button" variant="outline" onClick={handleUploadSources} disabled={uploading || saving}>
            {uploading ? "Cargando..." : "Cargar archivos"}
          </Button>
        </div>
      )}

      <BibliographySelector
        courseId={courseId}
        lessonId={lessonId}
        selected={bibliografia}
        onChange={setBibliografia}
        selectedAuthorized={authorizedSources}
        onAuthorizedChange={setAuthorizedSources}
        disabled={isConfirmed}
        planType={planType}
      />

      {!isConfirmed && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving || uploading}>
            Guardar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || uploading || totalSelectedSources === 0}>
            Confirmar relevamiento
          </Button>
        </div>
      )}
    </div>
  );
}
