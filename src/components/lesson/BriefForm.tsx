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
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import { formatErrorMessage, formatFunctionErrorMessage, logError } from "@/lib/errors";

interface BriefFormProps {
  lessonId: string;
  courseId: string;
  brief: LessonBriefRow | null;
  onUpdate: () => void;
  planType: PlanType;
  planTheme?: string | null;
  learningOutcome?: string | null;
  canonOperation?: string | null;
  canonEvidence?: string | null;
  mappedCurriculumNodes?: Array<{ id?: string; name?: string | null; node_type?: string | null }>;
  bibliographyNodes?: Array<{ id?: string; name?: string | null }>;
  authorizedSourceNodes?: Array<{ id?: string; title?: string | null; media_type?: string | null }>;
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

type BriefAutocompleteDraft = {
  enfoque: string;
  dinamica: string;
  profundidad: "BAJO" | "MEDIO" | "ALTO";
  observaciones: string;
  summary: string;
};

type LessonBriefRow = Tables<"lesson_briefs"> & {
  authorized_source_ids?: string[] | null;
};

type LessonBriefPayload = TablesInsert<"lesson_briefs"> & {
  authorized_source_ids?: string[];
};

type AuthorizedSourceRow = {
  id: string;
  source_url: string | null;
  title: string | null;
  media_type: string | null;
  origin_type: string | null;
  status: string | null;
};

type AuthorizedSourceInsert = {
  course_id: string;
  origin_type: string;
  plan_scope: PlanType;
  media_type: string;
  title: string;
  storage_path?: string | null;
  mime_type?: string | null;
  status: string;
  extracted_text?: string | null;
  summary_text?: string | null;
  author_label?: string | null;
  source_url?: string | null;
  metadata?: Json;
};

type AuthorizedSourceTargetInsert = {
  source_id: string;
  target_type: "LESSON";
  lesson_id: string;
};

type PremiumQueryRequestUpdate = {
  status: "APPROVED";
  selected_candidate: Json;
  approved_at: string;
};

const AUTHORIZED_SOURCES_TABLE = "authorized_sources" as never;
const AUTHORIZED_SOURCE_TARGETS_TABLE = "authorized_source_targets" as never;
const PREMIUM_QUERY_REQUESTS_TABLE = "premium_query_requests" as never;

function isMissingAuthorizedSourceIdsColumn(error: unknown): boolean {
  const message = formatErrorMessage(error, "").toLowerCase();
  return message.includes("authorized_source_ids") && (
    message.includes("column") ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

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

function normalizeSentence(value: string | null | undefined): string {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.endsWith(".") ? normalized : `${normalized}.`;
}

function toSentenceFragment(value: string | null | undefined): string {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.charAt(0).toLowerCase() + normalized.slice(1);
}

function summarizeItems(items: Array<string | null | undefined>, limit = 2): string {
  const cleaned = items.map((item) => (item || "").trim()).filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length <= limit) return cleaned.join(", ");
  return `${cleaned.slice(0, limit).join(", ")} y ${cleaned.length - limit} mas`;
}

function buildBriefAutocompleteDraft(input: {
  planTheme?: string | null;
  learningOutcome?: string | null;
  canonOperation?: string | null;
  canonEvidence?: string | null;
  mappedCurriculumNodes?: Array<{ name?: string | null; node_type?: string | null }>;
  bibliographyNodes?: Array<{ name?: string | null }>;
  authorizedSourceNodes?: Array<{ title?: string | null; media_type?: string | null }>;
}): BriefAutocompleteDraft {
  const mappedCount = input.mappedCurriculumNodes?.length || 0;
  const bibliographyCount = input.bibliographyNodes?.length || 0;
  const authorizedCount = input.authorizedSourceNodes?.length || 0;
  const totalSources = bibliographyCount + authorizedCount;
  const hasOutcome = Boolean((input.learningOutcome || "").trim());
  const hasEvidence = Boolean((input.canonEvidence || "").trim());

  let profundidad: "BAJO" | "MEDIO" | "ALTO" = "BAJO";
  if ((totalSources >= 3 && mappedCount >= 1) || (hasOutcome && hasEvidence)) {
    profundidad = "ALTO";
  } else if (totalSources >= 1 || mappedCount >= 1 || Boolean((input.canonOperation || "").trim())) {
    profundidad = "MEDIO";
  }

  const themeLabel = (input.planTheme || "la clase").trim();
  const outcomeFragment = toSentenceFragment(input.learningOutcome);
  const operationFragment = toSentenceFragment(input.canonOperation);
  const evidenceSentence = normalizeSentence(input.canonEvidence);
  const curriculumSummary = summarizeItems(input.mappedCurriculumNodes?.map((node) => node.name) || []);
  const bibliographySummary = summarizeItems(input.bibliographyNodes?.map((node) => node.name) || []);
  const authorizedSummary = summarizeItems(input.authorizedSourceNodes?.map((node) => node.title) || []);

  const enfoqueParts = [
    `Trabajar ${themeLabel}${outcomeFragment ? ` para que el grupo pueda ${outcomeFragment}` : ""}.`,
    operationFragment ? `Poner el foco en ${operationFragment}.` : "",
    curriculumSummary ? `Anclar la clase en ${curriculumSummary}.` : "",
  ].filter(Boolean);

  const dinamica =
    authorizedCount > 0
      ? "Apertura breve con activacion de saberes previos, analisis guiado de una fuente del docente en pequenos grupos y cierre con produccion breve de evidencia."
      : bibliographyCount > 0
      ? "Apertura con pregunta disparadora, lectura guiada de las fuentes seleccionadas, intercambio por parejas y cierre con sistematizacion comun."
      : "Apertura con recuperacion de ideas previas, desarrollo dialogado con consignas acotadas y cierre con verificacion rapida de comprension.";

  const observationParts = [
    hasOutcome ? `Asegurar que la consigna principal quede alineada con el resultado esperado: ${normalizeSentence(input.learningOutcome)}` : "",
    evidenceSentence ? `La evidencia esperada debe quedar visible durante el cierre: ${evidenceSentence}` : "",
    bibliographySummary ? `Priorizar bibliografia confirmada: ${bibliographySummary}.` : "",
    authorizedSummary ? `Integrar como respaldo del docente: ${authorizedSummary}.` : "",
    mappedCount > 0 ? `Mantener trazabilidad con ${mappedCount} nodo(s) curriculares asociados.` : "",
  ].filter(Boolean);

  return {
    enfoque: enfoqueParts.join(" "),
    dinamica,
    profundidad,
    observaciones: observationParts.join(" "),
    summary: `Profundidad ${profundidad.toLowerCase()} sugerida con ${mappedCount} nodo(s) curriculares y ${totalSources} fuente(s) ya disponibles.`,
  };
}

export default function BriefForm({
  lessonId,
  courseId,
  brief,
  onUpdate,
  planType,
  planTheme,
  learningOutcome,
  canonOperation,
  canonEvidence,
  mappedCurriculumNodes = [],
  bibliographyNodes = [],
  authorizedSourceNodes = [],
}: BriefFormProps) {
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
  const premiumAutocompleteDraft = useMemo(
    () =>
      buildBriefAutocompleteDraft({
        planTheme,
        learningOutcome,
        canonOperation,
        canonEvidence,
        mappedCurriculumNodes,
        bibliographyNodes,
        authorizedSourceNodes,
      }),
    [
      authorizedSourceNodes,
      bibliographyNodes,
      canonEvidence,
      canonOperation,
      learningOutcome,
      mappedCurriculumNodes,
      planTheme,
    ]
  );

  const buildPayload = (
    status?: "IN_PROGRESS" | "READY_FOR_PRODUCTION" | "PRODUCED",
    includeAuthorizedSources = true
  ): LessonBriefPayload => ({
    lesson_id: lessonId,
    enfoque_deseado: enfoque,
    tipo_dinamica_sugerida: dinamica,
    nivel_profundidad: profundidad,
    observaciones_docente: observaciones,
    bibliografia_confirmada: bibliografia,
    ...(includeAuthorizedSources ? { authorized_source_ids: authorizedSources } : {}),
    ...(status ? { status } : {}),
  });

  const persistBrief = async (status?: "IN_PROGRESS" | "READY_FOR_PRODUCTION" | "PRODUCED") => {
    const attempt = async (includeAuthorizedSources: boolean) => {
      const payload = buildPayload(status, includeAuthorizedSources);

      if (brief) {
        const { error } = await supabase.from("lesson_briefs").update(payload).eq("id", brief.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lesson_briefs").insert([payload]);
        if (error) throw error;
      }
    };

    try {
      await attempt(true);
    } catch (error) {
      if (!authorizedSources.length || !isMissingAuthorizedSourceIdsColumn(error)) {
        throw error;
      }

      await attempt(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistBrief();
      toast({ title: "Relevamiento guardado" });
      onUpdate();
    } catch (error) {
      logError("Brief save failed", error, { lessonId });
      toast({ title: "Error al guardar", description: formatErrorMessage(error), variant: "destructive" });
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
      await persistBrief("READY_FOR_PRODUCTION");
      toast({ title: "Relevamiento confirmado" });
      onUpdate();
    } catch (error) {
      logError("Brief confirmation failed", error, { lessonId });
      toast({ title: "Error al confirmar", description: formatErrorMessage(error), variant: "destructive" });
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

        const sourcePayload: AuthorizedSourceInsert = {
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
          .from(AUTHORIZED_SOURCES_TABLE)
          .insert(sourcePayload)
          .select("id")
          .single();
        const createdSourceRow = (createdSource || null) as unknown as Pick<AuthorizedSourceRow, "id"> | null;
        if (sourceError || !createdSourceRow?.id) {
          failedCount += 1;
          continue;
        }

        const targetPayload: AuthorizedSourceTargetInsert = {
          source_id: createdSourceRow.id,
          target_type: "LESSON",
          lesson_id: lessonId,
        };
        const { error: targetError } = await supabase.from(AUTHORIZED_SOURCE_TARGETS_TABLE).insert(targetPayload);
        if (targetError) {
          failedCount += 1;
          continue;
        }

        const { data: processResult, error: processError } = await supabase.functions.invoke(
          "process-authorized-source",
          {
            body: { source_id: createdSourceRow.id },
          }
        );

        if (processError || processResult?.error) {
          failedCount += 1;
          continue;
        }

        processedCount += 1;
        createdSourceIds.push(createdSourceRow.id);
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
          description: await formatFunctionErrorMessage(error),
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
    } catch (err: unknown) {
      logError("Premium query search failed", err, { lessonId });
      toast({ title: "Error al buscar", description: formatErrorMessage(err), variant: "destructive" });
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
        .from(AUTHORIZED_SOURCES_TABLE)
        .select("id, source_url")
        .in("id", authorizedSources);

      if (((existing || []) as unknown as Array<Pick<AuthorizedSourceRow, "id" | "source_url">>).some((row) => row.source_url === candidate.url)) {
        toast({ title: "Esta fuente ya fue agregada en la clase", variant: "destructive" });
        return;
      }
    }

    setApprovingCandidateUrl(candidate.url);
    try {
      const isVideo = isLikelyVideoCandidate(candidate, premiumResolvedType);
      const sourcePayload: AuthorizedSourceInsert = {
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
        .from(AUTHORIZED_SOURCES_TABLE)
        .insert(sourcePayload)
        .select("id")
        .single();

      const createdSourceRow = (createdSource || null) as unknown as Pick<AuthorizedSourceRow, "id"> | null;
      if (sourceError || !createdSourceRow?.id) {
        toast({ title: "No se pudo guardar la fuente aprobada", variant: "destructive" });
        return;
      }

      const targetPayload: AuthorizedSourceTargetInsert = {
        source_id: createdSourceRow.id,
        target_type: "LESSON",
        lesson_id: lessonId,
      };
      const { error: targetError } = await supabase.from(AUTHORIZED_SOURCE_TARGETS_TABLE).insert(targetPayload);
      if (targetError) {
        toast({ title: "No se pudo asociar la fuente a la clase", variant: "destructive" });
        return;
      }

      const requestUpdatePayload: PremiumQueryRequestUpdate = {
          status: "APPROVED",
          selected_candidate: candidate as unknown as Json,
          approved_at: new Date().toISOString(),
        };
      const { error: requestUpdateError } = await supabase
        .from(PREMIUM_QUERY_REQUESTS_TABLE)
        .update(requestUpdatePayload)
        .eq("id", premiumRequestId);

      if (requestUpdateError) {
        toast({
          title: "Fuente aprobada con advertencia",
          description: "No se pudo actualizar el estado de la consulta premium.",
          variant: "destructive",
        });
      }

      setAuthorizedSources((prev) => Array.from(new Set([...prev, createdSourceRow.id])));
      toast({ title: "Fuente premium aprobada y agregada" });
      onUpdate();
    } catch {
      toast({ title: "Error al aprobar la fuente", variant: "destructive" });
    } finally {
      setApprovingCandidateUrl(null);
    }
  };

  const handleApplyPremiumAutocomplete = () => {
    if (!canUsePremiumQuery) {
      toast({ title: "Esta funcion es solo para plan PREMIUM", variant: "destructive" });
      return;
    }

    setEnfoque(premiumAutocompleteDraft.enfoque);
    setDinamica(premiumAutocompleteDraft.dinamica);
    setProfundidad(premiumAutocompleteDraft.profundidad);
    setObservaciones(premiumAutocompleteDraft.observaciones);
    toast({
      title: "Brief autocompletado",
      description: premiumAutocompleteDraft.summary,
    });
  };

  return (
    <div className="space-y-4">
      {canUsePremiumQuery && !isConfirmed && (
        <div className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-3">
          <div className="space-y-1">
            <Label>Copiloto premium para el brief</Label>
            <p className="text-sm text-muted-foreground">{premiumAutocompleteDraft.summary}</p>
          </div>
          <Button type="button" variant="outline" onClick={handleApplyPremiumAutocomplete} disabled={saving || uploading}>
            Autocompletar brief con contexto de la clase
          </Button>
        </div>
      )}

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
