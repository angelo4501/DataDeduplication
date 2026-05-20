import { describe, expect, it } from "vitest";

import { calculateWeightedScore, findDuplicates } from "@/services/dedupe-engine";
import { mergeRecords, removeMergedDuplicates } from "@/services/dedupe-engine/merge";
import type { DuplicateGroup, ParsedRow } from "@/types";

function row(id: string, values: ParsedRow["values"]): ParsedRow {
  return {
    id,
    sourceFileId: "file-1",
    sheetId: "sheet-1",
    sheetName: "Sheet1",
    rowNumber: Number(id.replace(/\D/g, "")) || 1,
    values,
  };
}

describe("dedupe engine", () => {
  it("calculates high weighted scores for likely duplicates", () => {
    const left = row("row-1", {
      "Last Name": "Dela Cruz",
      "First Name": "Juan",
      Birthdate: "1990-01-01",
      "Middle Name": "Santos",
      Address: "123 Main Street",
    });
    const right = row("row-2", {
      surname: "Dela-Cruz",
      firstname: "Juan",
      DOB: "1990-01-01",
      "Middle Initial": "S",
      "Home Address": "123 Main St.",
    });

    expect(calculateWeightedScore(left, right).score).toBeGreaterThanOrEqual(85);
  });

  it("clusters duplicate records without grouping unique records", async () => {
    const records = [
      row("row-1", {
        "Last Name": "Garcia",
        "First Name": "Maria",
        Birthdate: "1988-05-10",
        Address: "10 Mabini Street",
      }),
      row("row-2", {
        surname: "Garcia",
        firstname: "Maria",
        DOB: "1988-05-10",
        "Home Address": "10 Mabini St",
      }),
      row("row-3", {
        "Last Name": "Reyes",
        "First Name": "Pedro",
        Birthdate: "1975-02-20",
        Address: "55 Rizal Avenue",
      }),
    ];

    const result = await findDuplicates(records);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].recordIds).toEqual(expect.arrayContaining(["row-1", "row-2"]));
    expect(result.groups[0].recordIds).not.toContain("row-3");
  });

  it("caps confidence when required identity fields disagree", () => {
    const left = row("row-1", {
      "Last Name": "Garcia",
      "First Name": "Maria",
      Birthdate: "1988-05-10",
      Address: "10 Mabini Street",
    });
    const right = row("row-2", {
      "Last Name": "Reyes",
      "First Name": "Maria",
      Birthdate: "1988-05-10",
      Address: "10 Mabini Street",
    });

    const result = calculateWeightedScore(left, right);

    expect(result.score).toBeLessThan(70);
    expect(result.reasons.find((reason) => reason.field === "lastName")?.score).toBeLessThan(85);
  });

  it("merges only selected records from larger duplicate groups", () => {
    const records = [
      row("row-1", {
        "First Name": "Maria",
        Address: "1 Short St",
      }),
      row("row-2", {
        "First Name": "Pedro",
        Address: "2 Different St",
      }),
      row("row-3", {
        "First Name": "Maria",
        Address: "100 Longer Example Street",
      }),
    ];
    const group: DuplicateGroup = {
      id: "group-1",
      recordIds: records.map((record) => record.id),
      records,
      confidence: 95,
      classification: "exact",
      reasons: [],
      status: "pending",
    };

    const { record, audit } = mergeRecords(group, {}, "manual", ["row-1", "row-3"]);
    const cleanedRows = removeMergedDuplicates(records, group, record, audit.selectedRecordIds);

    expect(audit.selectedRecordIds).toEqual(["row-1", "row-3"]);
    expect(record.values.Address).toBe("100 Longer Example Street");
    expect(cleanedRows.map((cleanedRow) => cleanedRow.id)).toEqual(["merged-group-1", "row-2"]);
  });
});
