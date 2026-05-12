import { describe, expect, it } from "vitest";

import {
  calculateAddressSimilarity,
  calculateNameSimilarity,
  calculateSimilarity,
  jaroWinkler,
} from "@/services/matching";

describe("matching", () => {
  it("scores exact and fuzzy strings", () => {
    expect(calculateSimilarity("Acme Printing", "Acme Printing").score).toBe(100);
    expect(calculateSimilarity("Acme Printing", "Acme Printng").score).toBeGreaterThanOrEqual(90);
  });

  it("matches uppercase and lowercase enye without flattening it to n", () => {
    expect(calculateNameSimilarity("PEÑA", "peña").score).toBe(100);
    expect(calculateNameSimilarity("PENA", "PEÑA").score).toBeLessThan(100);
  });

  it("detects nickname and swapped name similarity", () => {
    expect(calculateNameSimilarity("Mike", "Michael").score).toBeGreaterThanOrEqual(90);
    expect(calculateNameSimilarity("Juan Carlos", "Carlos Juan").score).toBeGreaterThanOrEqual(90);
  });

  it("calculates Jaro-Winkler and address token similarity", () => {
    expect(jaroWinkler("martha", "marhta")).toBeGreaterThan(0.9);
    expect(calculateAddressSimilarity("12 Main Street Apt 4", "12 Main St Apartment 4").score).toBeGreaterThanOrEqual(85);
  });
});
