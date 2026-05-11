import { describe, expect, it } from "vitest";

import {
  normalizeAddress,
  normalizeDate,
  normalizeName,
  normalizePhone,
  normalizeString,
} from "@/services/normalization";

describe("normalization", () => {
  it("normalizes accents, punctuation, case, and whitespace", () => {
    expect(normalizeString("  José   Dela-Cruz!!! ")).toBe("jose dela-cruz");
    expect(normalizeName("MARIA O'Connor Jr.")).toBe("maria oconnor");
  });

  it("normalizes equivalent Philippine mobile formats identically", () => {
    const expected = "9171234567";

    expect(normalizePhone("+63 917-123-4567")).toBe(expected);
    expect(normalizePhone("09171234567")).toBe(expected);
    expect(normalizePhone("9171234567")).toBe(expected);
  });

  it("normalizes dates and address abbreviations", () => {
    expect(normalizeDate("2024-01-31")).toBe("2024-01-31");
    expect(normalizeAddress("123 Main Street, Barangay 1")).toBe("123 main st brgy 1");
  });
});
