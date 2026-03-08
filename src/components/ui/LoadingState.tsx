import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface LoadingStateProps {
  /** Primary message shown to user */
  title?: string;
  /** Secondary hint */
  detail?: string;
  /** Rotating contextual tips to keep user engaged */
  tips?: string[];
  /** Variant: "page" for full-page, "card" for inline card, "inline" for compact */
  variant?: "page" | "card" | "inline";
  className?: string;
}

const DEFAULT_TIPS = [
  "Preparando todo para vos...",
  "Organizando la información...",
  "Ya casi está listo...",
];

export function LoadingState({
  title,
  detail,
  tips = DEFAULT_TIPS,
  variant = "card",
  className,
}: LoadingStateProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    if (tips.length <= 1) return;
    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setTipIndex((prev) => (prev + 1) % tips.length);
        setFadeIn(true);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, [tips.length]);

  const currentTip = tips[tipIndex];
  const showTitle = title || currentTip;

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="loading-dots" aria-hidden="true">
          <span /><span /><span />
        </div>
        <span className="text-sm text-muted-foreground">{showTitle}</span>
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div className={cn("flex min-h-screen items-center justify-center bg-background", className)}>
        <div className="flex flex-col items-center gap-5">
          <div className="loading-orbit" aria-hidden="true">
            <div className="loading-orbit-ring" />
            <div className="loading-orbit-dot" />
          </div>
          <div className="text-center space-y-2">
            <p className={cn(
              "text-sm font-medium text-foreground transition-opacity duration-300",
              fadeIn ? "opacity-100" : "opacity-0"
            )}>
              {showTitle}
            </p>
            {detail && (
              <p className="text-xs text-muted-foreground">{detail}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // card variant
  return (
    <div className={cn(
      "flex flex-col items-center gap-4 py-10 px-4",
      className,
    )}>
      <div className="loading-pulse-bars" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <div className="text-center space-y-1">
        <p className={cn(
          "text-sm font-medium text-foreground transition-opacity duration-300",
          fadeIn ? "opacity-100" : "opacity-0"
        )}>
          {showTitle}
        </p>
        {detail && (
          <p className="text-xs text-muted-foreground">{detail}</p>
        )}
      </div>
    </div>
  );
}
