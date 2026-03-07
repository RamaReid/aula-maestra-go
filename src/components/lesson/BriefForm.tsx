import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
const PREMIUM_RESOURCE_OPTIONS = ["AUTO", "VIDEO", "ARTICULO", "DOCUMENTO", "SITIO", "DATO"] as const;

type PremiumResourceOption = (typeof PREMIUM_RESOURCE_OPTIONS)[number];

type PremiumCandidate = {
  title: string;
  url: string;
  domain: string;
  snippet: string | null;
  source_type: string;
  confidence: number;
  fetched_at: string;
};

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

function normalizeUrlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isLikelyVideoCandidate(candidate: PremiumCandidate, resourceType: string | null): boolean {
  const domain = normalizeUrlDomain(candidate.url) || (candidate.domain || "").toLowerCase();
  if (resourceType === "VIDEO") return true;
  return (
    domain.includes("youtube.com") ||
    domain.includes("youtu.be") ||
    domain.includes("vimeo.com") ||
    domain.includes("dailymotion.com")
  );
}

async function parseFunctionErrorMessage(error: any): Promise<string> {
  if (!error) return "Error desconocido";
  if (typeof error.message === "string" && !error.context) return error.message;

  try {
    const context = error.context as Response | undefined;
    if (context) {
      const payload = await context.json();
      if (payload?.error) return payload.error;
    }
  } catch {
    // Ignore context parsing errors.
  }

  return typeof error.message === "string" ? error.message : "Error desconocido";
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
  const [premiumQuery, setPremiumQuery] = useState("");
  const [premiumResourceType, setPremiumResourceType] = useState<PremiumResourceOption>("AUTO");
  const [premiumCandidates, setPremiumCandidates] = useState<PremiumCandidate[]>([]);
  const [premiumRequestId, setPremiumRequestId] = useState<string | null>(null);
  const [premiumResolvedType, setPremiumResolvedType] = useState<string | null>(null);
  const [premiumCorrectedQuery, setPremiumCorrectedQuery] = useState<string | null>(null);
  const [resolvingPremium, setResolvingPremium] = useState(false);
  const [approvingCandidateUrl, setApprovingCandidateUrl] = useState<string | null>(null);

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
  const canUsePremiumQuery = planType === "PREMIUM";

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
      let failedCount = 0;

      for (const file of selectedFiles) {
        const extension = getFileExtension(file.name);
        if (!ALLOWED_EXTENSIONS.has(extension)) {
          failedCount += 1;
          continue;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          failedCount += 1;
          continue;
        }

        const safeName = sanitizeFileName(file.name);
        const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const filePath = `${courseId}/${lessonId}/${uniquePrefix}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("authorized-sources")
          .upload(filePath, file, { upsert: false, contentType: file.type || undefined });
        if (uploadError) {
          failedCount += 1;
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
          status: "PENDING",
          extracted_text: extractedText,
          summary_text: extractedText ? extractedText.slice(0, 600) : null,
        };

        const { data: createdSource, error: sourceError } = await supabase
          .from("authorized_sources" as any)
          .insert(sourcePayload)
          .select("id")
          .single();
        if (sourceError || !(createdSource as any)?.id) {
          failedCount += 1;
          continue;
        }

        const { error: targetError } = await supabase.from("authorized_source_targets" as any).insert({
          source_id: (createdSource as any).id,
          target_type: "LESSON",
          lesson_id: lessonId,
        });
        if (targetError) {
          failedCount += 1;
          continue;
        }

        const { data: processResult, error: processError } = await supabase.functions.invoke(
          "process-authorized-source",
          {
            body: { source_id: (createdSource as any).id },
          }
        );

        if (processError || processResult?.error) {
          failedCount += 1;
          continue;
        }

        processedCount += 1;
        createdSourceIds.push((createdSource as any).id as string);
      }

      if (createdSourceIds.length > 0) {
        setAuthorizedSources((prev) => Array.from(new Set([...prev, ...createdSourceIds])));
      }
      setSelectedFiles([]);
      if (processedCount > 0) {
        toast({
          title: `Fuentes procesadas: ${processedCount}`,
          description: failedCount > 0 ? `No se pudieron procesar ${failedCount} archivo(s).` : undefined,
        });
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

  const handleResolvePremiumQuery = async () => {
    if (!canUsePremiumQuery) {
      toast({ title: "Esta funcion es solo para plan PREMIUM", variant: "destructive" });
      return;
    }

    const cleanQuery = premiumQuery.trim();
    if (!cleanQuery) {
      toast({ title: "Escribe una consulta concreta", variant: "destructive" });
      return;
    }

    setResolvingPremium(true);
    try {
      const { data, error } = await supabase.functions.invoke("resolve-premium-query", {
        body: {
          course_id: courseId,
          lesson_id: lessonId,
          query: cleanQuery,
          resource_type: premiumResourceType === "AUTO" ? null : premiumResourceType,
          max_results: 3,
        },
      });

      if (error) {
        toast({
          title: "No se pudo resolver la consulta",
          description: await parseFunctionErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      if (data?.error) {
        toast({ title: "Consulta rechazada", description: data.error, variant: "destructive" });
        if (data?.request_id) setPremiumRequestId(data.request_id as string);
        setPremiumCandidates([]);
        return;
      }

      const candidates = Array.isArray(data?.candidates) ? (data.candidates as PremiumCandidate[]) : [];
      setPremiumCandidates(candidates);
      setPremiumRequestId(typeof data?.request_id === "string" ? data.request_id : null);
      setPremiumResolvedType(typeof data?.resource_type === "string" ? data.resource_type : null);
      setPremiumCorrectedQuery(typeof data?.corrected_query === "string" ? data.corrected_query : null);

      if (candidates.length === 0) {
        toast({
          title: "Sin resultados",
          description: "No se encontraron candidatos trazables para esta consulta.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Consulta premium resuelta",
        description: `${candidates.length} candidato(s) listos para aprobacion docente.`,
      });
    } catch (err: any) {
      toast({ title: "Error al buscar", description: err.message, variant: "destructive" });
    } finally {
      setResolvingPremium(false);
    }
  };

  const handleApprovePremiumCandidate = async (candidate: PremiumCandidate) => {
    if (!premiumRequestId) {
      toast({ title: "Primero resuelve la consulta", variant: "destructive" });
      return;
    }

    if (totalSelectedSources >= MAX_SOURCES) {
      toast({ title: `Maximo ${MAX_SOURCES} fuentes en total`, variant: "destructive" });
      return;
    }

    if (authorizedSources.some((id) => id)) {
      const { data: existing } = await supabase
        .from("authorized_sources" as any)
        .select("id, source_url")
        .in("id", authorizedSources);

      if (((existing || []) as unknown as Array<{ id: string; source_url: string | null }>).some((row) => row.source_url === candidate.url)) {
        toast({ title: "Esta fuente ya fue agregada en la clase", variant: "destructive" });
        return;
      }
    }

    setApprovingCandidateUrl(candidate.url);
    try {
      const isVideo = isLikelyVideoCandidate(candidate, premiumResolvedType);
      const sourcePayload = {
        course_id: courseId,
        origin_type: isVideo ? "DOCENTE_VIDEO" : "BUSQUEDA_PREMIUM",
        plan_scope: planType,
        media_type: isVideo ? "VIDEO" : "URL",
        title: candidate.title || candidate.url,
        author_label: candidate.domain || null,
        source_url: candidate.url,
        status: "APPROVED",
        summary_text: candidate.snippet || null,
        metadata: {
          premium_query_request_id: premiumRequestId,
          resolved_resource_type: premiumResolvedType,
          corrected_query: premiumCorrectedQuery,
          confidence: candidate.confidence ?? null,
          source_type: candidate.source_type ?? null,
          fetched_at: candidate.fetched_at ?? null,
        },
      };

      const { data: createdSource, error: sourceError } = await supabase
        .from("authorized_sources" as any)
        .insert(sourcePayload)
        .select("id")
        .single();

      if (sourceError || !createdSource?.id) {
        toast({ title: "No se pudo guardar la fuente aprobada", variant: "destructive" });
        return;
      }

      const { error: targetError } = await supabase.from("authorized_source_targets" as any).insert({
        source_id: createdSource.id,
        target_type: "LESSON",
        lesson_id: lessonId,
      });
      if (targetError) {
        toast({ title: "No se pudo asociar la fuente a la clase", variant: "destructive" });
        return;
      }

      const { error: requestUpdateError } = await supabase
        .from("premium_query_requests" as any)
        .update({
          status: "APPROVED",
          selected_candidate: candidate,
          approved_at: new Date().toISOString(),
        })
        .eq("id", premiumRequestId);

      if (requestUpdateError) {
        toast({
          title: "Fuente aprobada con advertencia",
          description: "No se pudo actualizar el estado de la consulta premium.",
          variant: "destructive",
        });
      }

      setAuthorizedSources((prev) => Array.from(new Set([...prev, createdSource.id as string])));
      toast({ title: "Fuente premium aprobada y agregada" });
      onUpdate();
    } catch {
      toast({ title: "Error al aprobar la fuente", variant: "destructive" });
    } finally {
      setApprovingCandidateUrl(null);
    }
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

      {canUsePremiumQuery && !isConfirmed && (
        <div className="space-y-3 rounded-md border p-3">
          <Label>Busqueda premium (consulta concreta)</Label>
          <Input
            value={premiumQuery}
            onChange={(event) => setPremiumQuery(event.target.value)}
            placeholder="Ej: video de Dario Sztajnszrajber sobre filosofia antigua para 4to ano"
            disabled={resolvingPremium || saving || uploading}
          />
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <Select
              value={premiumResourceType}
              onValueChange={(value) => setPremiumResourceType(value as PremiumResourceOption)}
              disabled={resolvingPremium || saving || uploading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de recurso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Auto-detectar</SelectItem>
                <SelectItem value="VIDEO">Video</SelectItem>
                <SelectItem value="ARTICULO">Articulo</SelectItem>
                <SelectItem value="DOCUMENTO">Documento</SelectItem>
                <SelectItem value="SITIO">Sitio web</SelectItem>
                <SelectItem value="DATO">Dato/estadistica</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={handleResolvePremiumQuery}
              disabled={resolvingPremium || saving || uploading}
            >
              {resolvingPremium ? "Buscando..." : "Buscar candidatos"}
            </Button>
          </div>
          {premiumCorrectedQuery && (
            <p className="text-xs text-muted-foreground">Sugerencia aplicada: {premiumCorrectedQuery}</p>
          )}
          {premiumCandidates.length > 0 && (
            <div className="space-y-2">
              {premiumCandidates.map((candidate, index) => {
                const isApproving = approvingCandidateUrl === candidate.url;
                const confidencePct = Math.max(0, Math.min(100, Math.round((candidate.confidence || 0) * 100)));
                return (
                  <div key={`${candidate.url}-${index}`} className="space-y-2 rounded-md border p-3">
                    <div className="text-sm font-medium">{candidate.title}</div>
                    <a
                      href={candidate.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block break-all text-xs text-primary underline"
                    >
                      {candidate.url}
                    </a>
                    {candidate.snippet && <p className="text-xs text-muted-foreground">{candidate.snippet}</p>}
                    <p className="text-xs text-muted-foreground">
                      {candidate.domain || "sin dominio"} | confianza {confidencePct}%
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleApprovePremiumCandidate(candidate)}
                      disabled={isApproving || resolvingPremium || saving || uploading}
                    >
                      {isApproving ? "Aprobando..." : "Aprobar y usar en esta clase"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Solo se acepta consulta concreta. La fuente elegida queda autorizada para esta clase.
          </p>
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
