import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Lock, RefreshCw, Sparkles, Target, Wand2 } from "lucide-react";
import type { CopilotoMode } from "@/hooks/useEntitlements";
import { ThinkingBook } from "@/components/ui/ThinkingBook";
import CopilotChat from "./CopilotChat";

interface CurriculumNode {
  id: string;
  name: string;
  node_type: string;
}

interface AuthorizedSourceSummary {
  id: string;
  title: string;
  media_type: string;
  origin_type: string;
  status: string;
}

interface PremiumRecommendation {
  id: string;
  title: string;
  detail: string;
  actionLabel?: string;
  action?: "focus_brief" | "apply_recommended_depth" | "regenerate_teaching" | "regenerate_reading";
}

interface CopilotPanelProps {
  bibliographyNodes: CurriculumNode[];
  referencedNodeIds: string[];
  mappedCurriculumNodes: CurriculumNode[];
  authorizedSources: AuthorizedSourceSummary[];
  depthLevel: "BAJO" | "MEDIO" | "ALTO";
  planTheme?: string | null;
  learningOutcome?: string | null;
  canonOperation?: string | null;
  canonEvidence?: string | null;
  briefFocus?: string | null;
  briefDynamic?: string | null;
  briefObservations?: string | null;
  briefStatus?: string | null;
  teachingStatus?: string | null;
  readingStatus?: string | null;
  onDepthChange: (level: "BAJO" | "MEDIO" | "ALTO") => void;
  onRegenerateTeaching: () => void;
  onRegenerateReading: () => void;
  onFocusBrief?: () => void;
  isGenerating: boolean;
  isLocked: boolean;
  copilotoMode?: CopilotoMode;
  subject?: string | null;
  yearLevel?: number | null;
}

function normalize(value: string | null | undefined): string {
  return (value || "").trim();
}

function getRecommendedDepth(params: {
  bibliographyCount: number;
  referencedCount: number;
  processedAuthorizedCount: number;
  hasFocus: boolean;
  hasDynamic: boolean;
  hasObservations: boolean;
}): "BAJO" | "MEDIO" | "ALTO" {
  const { bibliographyCount, referencedCount, processedAuthorizedCount, hasFocus, hasDynamic, hasObservations } = params;

  if (bibliographyCount >= 2 && referencedCount >= 1 && processedAuthorizedCount >= 1 && hasFocus && hasDynamic && hasObservations) {
    return "ALTO";
  }

  if (hasFocus && (hasDynamic || bibliographyCount >= 1)) {
    return "MEDIO";
  }

  return "BAJO";
}

function buildPremiumRecommendations(params: {
  briefFocus: string;
  briefDynamic: string;
  briefObservations: string;
  bibliographyCount: number;
  referencedCount: number;
  mappedCurriculumCount: number;
  processedAuthorizedCount: number;
  currentDepth: "BAJO" | "MEDIO" | "ALTO";
  recommendedDepth: "BAJO" | "MEDIO" | "ALTO";
  readingStatus: string | null | undefined;
  teachingStatus: string | null | undefined;
}): PremiumRecommendation[] {
  const {
    briefFocus,
    briefDynamic,
    briefObservations,
    bibliographyCount,
    referencedCount,
    mappedCurriculumCount,
    processedAuthorizedCount,
    currentDepth,
    recommendedDepth,
    readingStatus,
    teachingStatus,
  } = params;

  const recommendations: PremiumRecommendation[] = [];

  if (!briefFocus) {
    recommendations.push({
      id: "focus",
      title: "Defini el foco docente",
      detail: "Las indicaciones necesitan un enfoque explicito para que la generacion no derive en una clase generica.",
      actionLabel: "Ir a indicaciones",
      action: "focus_brief",
    });
  }

  if (!briefDynamic) {
    recommendations.push({
      id: "dynamic",
      title: "Completa la dinamica de trabajo",
      detail: "Agregar una dinamica sugerida ayuda a que el material didactico quede mas utilizable en aula.",
      actionLabel: "Ir a indicaciones",
      action: "focus_brief",
    });
  }

  if (!briefObservations) {
    recommendations.push({
      id: "observations",
      title: "Agrega observaciones de contexto",
      detail: "Con una nota docente breve, el copiloto puede sostener mejor adaptaciones y decisiones de tono.",
      actionLabel: "Ir a indicaciones",
      action: "focus_brief",
    });
  }

  if (mappedCurriculumCount < 2) {
    recommendations.push({
      id: "curriculum",
      title: "Refuerza el anclaje curricular",
      detail: "La clase parece apoyarse en pocos nodos del programa. Conviene revisar las indicaciones y la planificacion antes de regenerar.",
      actionLabel: "Ir a indicaciones",
      action: "focus_brief",
    });
  }

  if (bibliographyCount === 0) {
    recommendations.push({
      id: "bibliography",
      title: "Confirma bibliografia antes de producir",
      detail: "Todavia no hay fuentes confirmadas para esta leccion. El copiloto premium mejora cuando parte de un set bibliografico cerrado.",
      actionLabel: "Ir a indicaciones",
      action: "focus_brief",
    });
  } else if (referencedCount === 0 && readingStatus) {
    recommendations.push({
      id: "reading-coverage",
      title: "La lectura no esta citando las fuentes confirmadas",
      detail: "Conviene regenerar el material de lectura para mejorar la vinculacion bibliografica.",
      actionLabel: "Regenerar lectura",
      action: "regenerate_reading",
    });
  }

  if (processedAuthorizedCount > 0 && teachingStatus !== "VALIDATED") {
    recommendations.push({
      id: "teacher-sources",
      title: "Ya hay fuentes del docente procesadas",
      detail: "Aprovecha ese material y regenera el didactico para incorporarlo de forma mas explicita.",
      actionLabel: "Regenerar didactico",
      action: "regenerate_teaching",
    });
  }

  if (currentDepth !== recommendedDepth) {
    recommendations.push({
      id: "depth",
      title: `Profundidad sugerida: ${recommendedDepth}`,
      detail: "El contexto de la clase indica que un nivel de profundidad distinto puede mejorar la coherencia del resultado.",
      actionLabel: "Aplicar sugerencia",
      action: "apply_recommended_depth",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "healthy-state",
      title: "Clase bien preparada para premium",
      detail: "Las indicaciones, la bibliografia y el anclaje curricular ya dan una base solida para regenerar con ajustes finos.",
    });
  }

  return recommendations.slice(0, 5);
}

export default function CopilotPanel({
  bibliographyNodes,
  referencedNodeIds,
  mappedCurriculumNodes,
  authorizedSources,
  depthLevel,
  planTheme,
  learningOutcome,
  canonOperation,
  canonEvidence,
  briefFocus,
  briefDynamic,
  briefObservations,
  briefStatus,
  teachingStatus,
  readingStatus,
  onDepthChange,
  onRegenerateTeaching,
  onRegenerateReading,
  onFocusBrief,
  isGenerating,
  isLocked,
  copilotoMode = "full",
}: CopilotPanelProps) {
  const isDisabled = copilotoMode === "none";
  const isPremium = copilotoMode === "full";
  const referencedCount = bibliographyNodes.filter((node) => referencedNodeIds.includes(node.id)).length;
  const processedAuthorizedSources = authorizedSources.filter((source) => source.status === "PROCESSED" || source.status === "APPROVED");
  const recommendedDepth = getRecommendedDepth({
    bibliographyCount: bibliographyNodes.length,
    referencedCount,
    processedAuthorizedCount: processedAuthorizedSources.length,
    hasFocus: !!normalize(briefFocus),
    hasDynamic: !!normalize(briefDynamic),
    hasObservations: !!normalize(briefObservations),
  });

  const premiumRecommendations = buildPremiumRecommendations({
    briefFocus: normalize(briefFocus),
    briefDynamic: normalize(briefDynamic),
    briefObservations: normalize(briefObservations),
    bibliographyCount: bibliographyNodes.length,
    referencedCount,
    mappedCurriculumCount: mappedCurriculumNodes.length,
    processedAuthorizedCount: processedAuthorizedSources.length,
    currentDepth: depthLevel,
    recommendedDepth,
    readingStatus,
    teachingStatus,
  });

  const handleRecommendationAction = (action?: PremiumRecommendation["action"]) => {
    if (!action || isGenerating || isLocked || isDisabled) return;

    if (action === "focus_brief") {
      onFocusBrief?.();
      return;
    }
    if (action === "apply_recommended_depth") {
      onDepthChange(recommendedDepth);
      return;
    }
    if (action === "regenerate_teaching") {
      onRegenerateTeaching();
      return;
    }
    if (action === "regenerate_reading") {
      onRegenerateReading();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Asistente</p>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">Copiloto</h3>
        </div>
        <Badge variant={isPremium ? "default" : "outline"}>{isPremium ? "Premium" : copilotoMode === "limited" ? "Basico" : "Bloqueado"}</Badge>
      </div>

      {isDisabled && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Actualiza tu plan para usar el Copiloto.
          </AlertDescription>
        </Alert>
      )}

      {isGenerating && (
        <div className="rounded-md border p-3">
          <ThinkingBook compact title="Copiloto en elaboracion" detail="Esperando resultados de generacion." />
        </div>
      )}

      {!isDisabled && (
        <Alert>
          {isPremium ? <Sparkles className="h-4 w-4" /> : <Target className="h-4 w-4" />}
          <AlertTitle>{isPremium ? "Diagnostico contextual activo" : "Modo operativo limitado"}</AlertTitle>
          <AlertDescription className="text-xs">
            {isPremium
              ? "El copiloto premium analiza indicaciones, vinculacion curricular, bibliografia y estado de materiales para sugerir ajustes concretos."
              : "En Basico el copiloto controla profundidad, bibliografia sugerida visible y regeneracion de materiales."}
          </AlertDescription>
        </Alert>
      )}

      {isPremium && !isDisabled && (
        <div className="space-y-3 rounded-[1.35rem] border border-border/70 bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            <Label className="text-xs">Lectura de contexto</Label>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <div className="rounded-xl bg-background p-3">
              <span className="font-medium text-foreground">Tema:</span> {normalize(planTheme) || "Sin tema detectado"}
            </div>
            <div className="rounded-xl bg-background p-3">
              <span className="font-medium text-foreground">Resultado esperado:</span> {normalize(learningOutcome) || "Sin resultado esperado detectado"}
            </div>
            <div className="rounded-xl bg-background p-3">
              <span className="font-medium text-foreground">Operacion:</span> {normalize(canonOperation) || "Sin operacion sintetizada"}
            </div>
            <div className="rounded-xl bg-background p-3">
              <span className="font-medium text-foreground">Evidencia:</span> {normalize(canonEvidence) || "Sin evidencia minima sintetizada"}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Bibliografia sugerida usada</Label>
        <div className="space-y-1">
          {bibliographyNodes.length === 0 ? (
            <p className="text-xs text-muted-foreground">Todavia no hay bibliografia confirmada para esta clase.</p>
          ) : (
            bibliographyNodes.map((node) => (
              <div key={node.id} className="flex items-center gap-2 text-xs">
                <Badge
                  variant={referencedNodeIds.includes(node.id) ? "default" : "outline"}
                  className="px-1 text-[10px]"
                >
                  {node.node_type}
                </Badge>
                <span className={referencedNodeIds.includes(node.id) ? "text-foreground" : "text-muted-foreground"}>
                  {node.name}
                </span>
                {referencedNodeIds.includes(node.id) && <span className="text-[10px] text-primary">citado</span>}
              </div>
            ))
          )}
        </div>
      </div>

      {!isDisabled && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/70 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cobertura bibliografica</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {referencedCount} de {bibliographyNodes.length || 0} fuentes citadas
            </p>
          </div>
          <div className="rounded-xl border border-border/70 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fuentes del docente</p>
            <p className="mt-1 text-sm font-medium text-foreground">{processedAuthorizedSources.length} procesadas</p>
          </div>
          <div className="rounded-xl border border-border/70 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contenidos curriculares</p>
            <p className="mt-1 text-sm font-medium text-foreground">{mappedCurriculumNodes.length} vinculados</p>
          </div>
          <div className="rounded-xl border border-border/70 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Estado de indicaciones</p>
            <p className="mt-1 text-sm font-medium text-foreground">{briefStatus || "Sin indicaciones"}</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Nivel de profundidad</Label>
        <Select value={depthLevel} onValueChange={(v) => onDepthChange(v as "BAJO" | "MEDIO" | "ALTO")} disabled={isGenerating || isLocked || isDisabled}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BAJO">Bajo</SelectItem>
            <SelectItem value="MEDIO">Medio</SelectItem>
            <SelectItem value="ALTO">Alto</SelectItem>
          </SelectContent>
        </Select>
        {isPremium && !isDisabled && (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Sugerencia premium</span>
            <div className="flex items-center gap-2">
              <Badge variant={recommendedDepth === depthLevel ? "default" : "outline"}>{recommendedDepth}</Badge>
              {recommendedDepth !== depthLevel && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onDepthChange(recommendedDepth)} disabled={isGenerating || isLocked}>
                  Aplicar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {isPremium && !isDisabled && (
        <div className="space-y-2">
          <Label className="text-xs">Recomendaciones premium</Label>
          <div className="space-y-2">
            {premiumRecommendations.map((recommendation) => (
              <div key={recommendation.id} className="rounded-xl border border-border/70 p-3">
                <p className="text-sm font-medium text-foreground">{recommendation.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{recommendation.detail}</p>
                {recommendation.actionLabel && recommendation.action && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 h-7 text-xs"
                    onClick={() => handleRecommendationAction(recommendation.action)}
                    disabled={isGenerating || isLocked}
                  >
                    {recommendation.actionLabel}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Regenerar</Label>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerateTeaching}
            disabled={isGenerating || isLocked || isDisabled}
            className="text-xs"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Material didactico
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerateReading}
            disabled={isGenerating || isLocked || isDisabled}
            className="text-xs"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Material de lectura
          </Button>
        </div>
      </div>
    </div>
  );
}
