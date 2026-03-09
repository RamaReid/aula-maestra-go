import { Sparkles, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

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
      <Button onClick={onClick} disabled={disabled || isGenerating} className="w-full sm:w-auto" size="lg">
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Elaborando materiales...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Generar
          </>
        )}
      </Button>
    </div>
  );
}
