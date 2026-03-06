import type { PlanType } from "@/hooks/useEntitlements";

export function getMaxSelectableLessons(planType: PlanType, lessonCount: number): number {
  if (planType === "FREE") return 3;
  return Math.max(0, lessonCount);
}

export function isConsecutiveSequence(lessonNumbers: number[]): boolean {
  if (lessonNumbers.length <= 1) return true;
  const sorted = [...lessonNumbers].sort((a, b) => a - b);
  return sorted.every((lessonNumber, index) =>
    index === 0 ? true : lessonNumber === sorted[index - 1] + 1
  );
}

export function isValidFreeSelection(selectedCount: number): boolean {
  return selectedCount === 3;
}
