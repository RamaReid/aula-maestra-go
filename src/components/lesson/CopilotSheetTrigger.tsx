import { Bot, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { CopilotoMode } from "@/hooks/useEntitlements";
import CopilotChat from "./CopilotChat";

interface LessonContext {
  theme?: string | null;
  learningOutcome?: string | null;
  canonOperation?: string | null;
  canonEvidence?: string | null;
  briefFocus?: string | null;
  briefDynamic?: string | null;
  depthLevel?: string | null;
  teachingStatus?: string | null;
  readingStatus?: string | null;
  subject?: string | null;
  yearLevel?: number | null;
  curriculumNodeNames?: string[];
  bibliographyNames?: string[];
  authorizedSourceTitles?: string[];
}

interface CopilotSheetTriggerProps {
  copilotoMode: CopilotoMode;
  /** Full panel content (lesson-level detail). If omitted, shows chat-only. */
  panelContent?: React.ReactNode;
  /** Context for the chat AI */
  lessonContext?: LessonContext;
  subject?: string | null;
  yearLevel?: number | null;
}

export default function CopilotSheetTrigger({
  copilotoMode,
  panelContent,
  lessonContext,
  subject,
  yearLevel,
}: CopilotSheetTriggerProps) {
  const isDisabled = copilotoMode === "none";
  const isPremium = copilotoMode === "full";
  const isLimited = copilotoMode === "limited";

  const modeLabel = isPremium ? "Premium" : isLimited ? "Básico" : "Bloqueado";

  const defaultContext: LessonContext = lessonContext ?? {
    subject,
    yearLevel,
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bot className="h-4 w-4" />
          <span>Copiloto</span>
          {isPremium && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Copiloto
            </SheetTitle>
            <Badge variant={isPremium ? "default" : "outline"}>{modeLabel}</Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-6">
            {isDisabled && (
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Actualizá tu plan para usar el Copiloto. En el plan Básico tenés asistencia operativa, y en Premium accedés al chat conversacional y diagnóstico contextual completo.
                </AlertDescription>
              </Alert>
            )}

            {isLimited && !panelContent && (
              <Alert>
                <Bot className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  En el plan Básico, el copiloto te acompaña con controles de profundidad y regeneración de materiales. Pasá a Premium para acceder al chat conversacional y las recomendaciones contextuales.
                </AlertDescription>
              </Alert>
            )}

            {/* Full lesson-level panel if provided */}
            {panelContent}

            {/* Chat-only fallback when no panelContent but has access */}
            {!panelContent && !isDisabled && (
              <div className="space-y-2">
                {isPremium ? (
                  <CopilotChat
                    copilotoMode={copilotoMode}
                    lessonContext={defaultContext}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    El chat del copiloto está disponible en el plan Premium. Desde una lección con indicaciones listas, podés usar los controles de profundidad y regeneración.
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
