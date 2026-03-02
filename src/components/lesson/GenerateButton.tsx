import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";

interface GenerateButtonProps {
  onClick: () => void;
  isGenerating: boolean;
  disabled: boolean;
}

export default function GenerateButton({ onClick, isGenerating, disabled }: GenerateButtonProps) {
  return (
    <Button onClick={onClick} disabled={disabled || isGenerating} className="w-full">
      {isGenerating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generando...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Generar
        </>
      )}
    </Button>
  );
}
