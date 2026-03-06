import { describe, expect, it } from "vitest";

import { getMaxSelectableLessons, isConsecutiveSequence, isValidFreeSelection } from "@/lib/courseSelectionRules";

describe("courseSelectionRules", () => {
  it("caps FREE at exactly 3 selectable lessons", () => {
    expect(getMaxSelectableLessons("FREE", 28)).toBe(3);
  });

  it("uses full lesson count for BASICO and PREMIUM", () => {
    expect(getMaxSelectableLessons("BASICO", 28)).toBe(28);
    expect(getMaxSelectableLessons("PREMIUM", 12)).toBe(12);
  });

  it("detects consecutive sequences correctly", () => {
    expect(isConsecutiveSequence([3, 4, 5])).toBe(true);
    expect(isConsecutiveSequence([5, 3, 4])).toBe(true);
    expect(isConsecutiveSequence([3, 5, 6])).toBe(false);
  });

  it("requires exactly 3 lessons for FREE selection", () => {
    expect(isValidFreeSelection(2)).toBe(false);
    expect(isValidFreeSelection(3)).toBe(true);
    expect(isValidFreeSelection(4)).toBe(false);
  });
});
