import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { ThinkingBook } from "@/components/ui/ThinkingBook";

interface GenerateButtonProps {
  onClick: () => void;
  isGenerating: boolean;
  disabled: boolean;
}

export default function GenerateButton({ onClick, isGenerating, disabled }: GenerateButtonProps) {
  return (
    <div className="space-y-2">
      <Button onClick={onClick} disabled={disabled || isGenerating} className="w-full">
        {isGenerating ? (
          "Elaborando..."
        ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Generar
        </>
        )}
      </Button>
      {isGenerating && (
        <div className="rounded-md border p-3">
          <ThinkingBook
            compact
            title="El sistema esta elaborando la clase y materiales"
            detail="No hace falta interactuar hasta que termine."
          />
        </div>
      )}
    </div>
  );
}
