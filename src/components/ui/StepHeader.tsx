import type { ComponentProps } from "react";

import { StatusBadge } from "./StatusBadge";

interface StepHeaderProps {
  stepNumber: number;
  title: string;
  status: string;
  statusTone: ComponentProps<typeof StatusBadge>["tone"];
}

export function StepHeader({ stepNumber, title, status, statusTone }: StepHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Paso {stepNumber}
        </p>
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      <StatusBadge tone={statusTone} label={status} />
    </div>
  );
}
