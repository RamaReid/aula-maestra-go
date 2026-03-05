import { cn } from "@/lib/utils";

interface ThinkingBookProps {
  title?: string;
  detail?: string;
  compact?: boolean;
  className?: string;
}

export function ThinkingBook({
  title = "Elaborando material...",
  detail = "Esto puede tardar unos segundos.",
  compact = false,
  className,
}: ThinkingBookProps) {
  return (
    <div className={cn("curriculum-book-loader", compact && "gap-2", className)}>
      <div className={cn("curriculum-book-icon", compact && "h-8 w-8")} aria-hidden="true">
        <span className="curriculum-book-cover" />
        <span className="curriculum-book-page curriculum-book-page-1" />
        <span className="curriculum-book-page curriculum-book-page-2" />
        <span className="curriculum-book-page curriculum-book-page-3" />
      </div>
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>{title}</p>
        <p className="text-xs">{detail}</p>
      </div>
    </div>
  );
}
