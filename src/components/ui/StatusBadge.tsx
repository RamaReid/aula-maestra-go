import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "archived" | "neutral";

interface StatusBadgeProps {
  tone: Tone;
  label: string;
  className?: string;
}

const toneClasses: Record<Tone, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  archived: "bg-archived/15 text-archived border-archived/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ tone, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        toneClasses[tone],
        className
      )}
    >
      {label}
    </span>
  );
}

// --- Canonical mapping helpers ---

export function briefLabel(status: string | null | undefined): string {
  switch (status) {
    case "READY_FOR_PRODUCTION": return "Listo";
    case "PRODUCED": return "Producido";
    case "IN_PROGRESS": return "En progreso";
    default: return "Borrador";
  }
}

export function briefTone(status: string | null | undefined): Tone {
  switch (status) {
    case "READY_FOR_PRODUCTION":
    case "PRODUCED":
      return "success";
    case "IN_PROGRESS":
      return "warning";
    default:
      return "neutral";
  }
}

export function materialLabel(status: string | null | undefined): string {
  switch (status) {
    case "INVALIDATED": return "Invalidado";
    case "EDITED": return "Editado";
    case "GENERATED": return "Generado";
    case "VALIDATED": return "Validado";
    default: return "Sin generar";
  }
}

export function materialTone(status: string | null | undefined): Tone {
  switch (status) {
    case "INVALIDATED":
    case "EDITED":
      return "danger";
    case "GENERATED":
      return "warning";
    case "VALIDATED":
      return "success";
    default:
      return "neutral";
  }
}

export function planLabel(status: string | null | undefined): string {
  switch (status) {
    case "VALIDATED": return "Validado";
    case "EDITED": return "Editado";
    default: return "Incompleto";
  }
}

export function planTone(status: string | null | undefined): Tone {
  switch (status) {
    case "VALIDATED": return "success";
    case "EDITED": return "danger";
    default: return "warning";
  }
}

export function lessonStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PLANNED: "Planificada",
    TAUGHT: "Dictada",
    RESCHEDULED: "Reprogramada",
    LOCKED: "Bloqueada",
  };
  return map[status] || status;
}

export function lessonStatusTone(status: string): Tone {
  switch (status) {
    case "TAUGHT": return "success";
    case "LOCKED": return "danger";
    case "RESCHEDULED": return "warning";
    default: return "neutral";
  }
}
