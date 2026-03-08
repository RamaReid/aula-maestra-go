import type { ReactNode } from "react";

import { filterDocumentMeta, type DocumentMetaItem } from "@/lib/editorial";
import { cn } from "@/lib/utils";

interface DocumentSheetProps {
  eyebrow?: string;
  title: string;
  summary?: string;
  meta?: DocumentMetaItem[];
  status?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function DocumentSheet({
  eyebrow,
  title,
  summary,
  meta = [],
  status,
  actions,
  children,
  className,
  bodyClassName,
}: DocumentSheetProps) {
  const visibleMeta = filterDocumentMeta(meta);

  return (
    <article className={cn("document-sheet", className)}>
      <header className="document-header">
        <div className="space-y-3">
          {eyebrow ? <p className="document-eyebrow">{eyebrow}</p> : null}
          <div className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="document-title">{title}</h3>
              {status ? <div className="shrink-0">{status}</div> : null}
            </div>
            {summary ? <p className="document-summary">{summary}</p> : null}
          </div>
        </div>

        {(visibleMeta.length > 0 || actions) && (
          <div className="space-y-4">
            {visibleMeta.length > 0 ? (
              <dl className="document-meta-grid">
                {visibleMeta.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="document-meta-item">
                    <dt className="document-meta-label">{item.label}</dt>
                    <dd className="document-meta-value">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {actions ? <div className="document-toolbar">{actions}</div> : null}
          </div>
        )}
      </header>

      <div className={cn("document-body", bodyClassName)}>{children}</div>
    </article>
  );
}
