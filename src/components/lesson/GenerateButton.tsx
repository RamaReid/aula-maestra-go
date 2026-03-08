import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThinkingBook } from "@/components/ui/ThinkingBook";

interface GenerateButtonProps {
  onClick: () => void;
  isGenerating: boolean;
  disabled: boolean;
}

export default function GenerateButton({ onClick, isGenerating, disabled }: GenerateButtonProps) {
  return (
    <div className="space-y-3">
      <div className="helper-note">
        Cuando las indicaciones ya estan confirmadas, el sistema produce un material didactico y una lectura con formato listo para revisar, imprimir o compartir.
      </div>
      <Button onClick={onClick} disabled={disabled || isGenerating} className="w-full sm:w-auto">
        {isGenerating ? (
          "Elaborando..."
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Generar
          </>
        )}
      </Button>
      {isGenerating ? (
        <div className="rounded-2xl border border-border/70 bg-card/80 p-3">
          <ThinkingBook
            compact
            title="El sistema esta elaborando la clase y materiales"
            detail="No hace falta interactuar hasta que termine."
          />
        </div>
      ) : null}
    </div>
  );
}
