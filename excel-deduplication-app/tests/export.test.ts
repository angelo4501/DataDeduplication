import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { buildCleanCsv, buildCleanWorkbook } from "@/services/export";
import type { ExportPayload, ParsedRow } from "@/types";

function row(id: string, values: ParsedRow["values"]): ParsedRow {
  return {
    id,
    sourceFileId: "file-1",
    sheetId: "sheet-1",
    sheetName: "Sheet1",
    rowNumber: 1,
    values,
  };
}

describe("export", () => {
  it("preserves Ñ and ñ in clean CSV exports", () => {
    const csv = buildCleanCsv([
      row("row-1", {
        Name: "Peña",
        Notes: "Ñora record",
      }),
    ]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Peña");
    expect(csv).toContain("Ñora record");
  });

  it("preserves Ñ and ñ in clean workbook exports", () => {
    const payload: ExportPayload = {
      cleanedRows: [
        row("row-1", {
          Name: "Peña",
          Notes: "Ñora record",
        }),
      ],
      duplicateGroups: [],
      auditTrail: [],
      generatedAt: "2026-05-12T00:00:00.000Z",
    };

    const workbook = buildCleanWorkbook(payload);
    const exportedRows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets["Cleaned Data"]);

    expect(exportedRows[0]).toMatchObject({
      Name: "Peña",
      Notes: "Ñora record",
    });
  });
});
