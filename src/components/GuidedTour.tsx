import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useTour, type TourStep } from "@/hooks/useTour";
import { X, ArrowRight, ArrowLeft } from "lucide-react";

interface Props {
  steps: TourStep[];
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

const PADDING = 6;
const TOOLTIP_GAP = 12;

export default function GuidedTour({ steps }: Props) {
  const { isOpen, currentStep, step, totalSteps, next, prev, skip } = useTour(steps);
  const [rect, setRect] = useState<Rect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top - PADDING,
      left: r.left - PADDING,
      width: r.width + PADDING * 2,
      height: r.height + PADDING * 2,
      bottom: r.bottom + PADDING,
      right: r.right + PADDING,
    });
  }, [step]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  // Re-measure on step change with a small delay for DOM updates
  useEffect(() => {
    const timer = setTimeout(measure, 100);
    return () => clearTimeout(timer);
  }, [currentStep, measure]);

  if (!isOpen || !step) return null;

  const clipPath = rect
    ? `polygon(
        0% 0%, 0% 100%, 
        ${rect.left}px 100%, 
        ${rect.left}px ${rect.top}px, 
        ${rect.right}px ${rect.top}px, 
        ${rect.right}px ${rect.bottom}px, 
        ${rect.left}px ${rect.bottom}px, 
        ${rect.left}px 100%, 
        100% 100%, 100% 0%
      )`
    : undefined;

  // Calculate tooltip position
  const tooltipStyle: React.CSSProperties = {};
  if (rect) {
    tooltipStyle.top = rect.bottom + TOOLTIP_GAP;
    tooltipStyle.left = Math.max(16, Math.min(rect.left, window.innerWidth - 340));

    // If tooltip would go below viewport, show above
    if (rect.bottom + TOOLTIP_GAP + 200 > window.innerHeight) {
      tooltipStyle.top = Math.max(16, rect.top - TOOLTIP_GAP - 180);
    }
  }

  const isLast = currentStep === totalSteps - 1;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* Overlay with spotlight cutout */}
      <div
        className="absolute inset-0 bg-black/50 transition-all duration-300"
        style={{ clipPath }}
        onClick={skip}
      />

      {/* Spotlight border highlight */}
      {rect && (
        <div
          className="absolute rounded-lg ring-2 ring-primary/60 pointer-events-none transition-all duration-300"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute w-80 rounded-xl border bg-card p-4 shadow-lg transition-all duration-300"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
          <button
            onClick={skip}
            className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">{step.description}</p>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {currentStep + 1} de {totalSteps}
          </span>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="ghost" size="sm" onClick={prev}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Anterior
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {isLast ? "Entendido" : "Siguiente"}
              {!isLast && <ArrowRight className="h-3.5 w-3.5 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
