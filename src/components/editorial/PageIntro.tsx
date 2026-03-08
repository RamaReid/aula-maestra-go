import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageIntroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageIntro({ eyebrow, title, description, actions, className }: PageIntroProps) {
  return (
    <section className={cn("page-intro", className)}>
      <div className="space-y-3">
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        <div className="space-y-2">
          <h1 className="page-title">{title}</h1>
          {description ? <p className="page-summary">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </section>
  );
}
