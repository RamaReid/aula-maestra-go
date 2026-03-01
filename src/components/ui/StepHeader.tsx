import { StatusBadge } from "./StatusBadge";
import type { ComponentProps } from "react";

interface StepHeaderProps {
  stepNumber: number;
  title: string;
  status: string;
  statusTone: ComponentProps<typeof StatusBadge>["tone"];
}

export function StepHeader({ stepNumber, title, status, statusTone }: StepHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold">
        Paso {stepNumber} — {title}
      </h2>
      <StatusBadge tone={statusTone} label={status} />
    </div>
  );
}
