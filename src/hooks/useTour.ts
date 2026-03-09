import { useState, useCallback } from "react";

export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  description: string;
}

export function useTour(steps: TourStep[]) {
  const [isOpen, setIsOpen] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  const next = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      setIsOpen(false);
    }
  }, [currentStep, steps.length]);

  const prev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const skip = useCallback(() => {
    setIsOpen(false);
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  return {
    isOpen,
    currentStep,
    step: steps[currentStep] ?? null,
    totalSteps: steps.length,
    next,
    prev,
    skip,
    reset,
  };
}
