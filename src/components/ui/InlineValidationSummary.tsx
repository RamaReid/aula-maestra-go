import { AlertCircle } from "lucide-react";

interface InlineValidationSummaryProps {
  errors: string[];
}

export function InlineValidationSummary({ errors }: InlineValidationSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 space-y-2">
      {errors.map((error, i) => (
        <div key={i} className="flex items-start gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ))}
    </div>
  );
}
