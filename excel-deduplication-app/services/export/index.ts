import Papa from "papaparse";
import * as XLSX from "xlsx";

import type { DuplicateGroup, ExportPayload, ParsedRow } from "@/types";
import { escapeCsvFormula } from "@/utils/security";

function rowsToPlainObjects(rows: ParsedRow[]): Record<string, string>[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row.values).map(([key, value]) => [key, escapeCsvFormula(value)]),
    ),
  );
}

function duplicateReport(groups: DuplicateGroup[]): Record<string, string | number>[] {
  return groups.flatMap((group) =>
    group.records.map((record) => ({
      groupId: group.id,
      rowId: record.id,
      confidence: group.confidence,
      classification: group.classification,
      status: group.status,
      reasons: group.reasons
        .map((reason) => `${reason.label}: ${reason.score}% (${reason.strategy})`)
        .join("; "),
      ...Object.fromEntries(Object.entries(record.values).map(([key, value]) => [key, escapeCsvFormula(value)])),
    })),
  );
}

export function buildCleanCsv(rows: ParsedRow[]): string {
  return Papa.unparse(rowsToPlainObjects(rows), {
    quotes: false,
    newline: "\n",
  });
}

export function buildDuplicateReportCsv(groups: DuplicateGroup[]): string {
  return Papa.unparse(duplicateReport(groups), {
    quotes: false,
    newline: "\n",
  });
}

export function buildAuditTrailCsv(payload: ExportPayload): string {
  return Papa.unparse(
    payload.auditTrail.map((entry) => ({
      id: entry.id,
      groupId: entry.groupId,
      timestamp: entry.timestamp,
      strategy: entry.strategy,
      selectedRecordIds: entry.selectedRecordIds.join(", "),
      mergedValues: JSON.stringify(entry.mergedValues),
      notes: entry.notes ?? "",
    })),
  );
}

export function buildCleanWorkbook(payload: ExportPayload): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const cleaned = XLSX.utils.json_to_sheet(rowsToPlainObjects(payload.cleanedRows));
  const duplicates = XLSX.utils.json_to_sheet(duplicateReport(payload.duplicateGroups));
  const audit = XLSX.utils.json_to_sheet(
    payload.auditTrail.map((entry) => ({
      id: entry.id,
      groupId: entry.groupId,
      timestamp: entry.timestamp,
      strategy: entry.strategy,
      selectedRecordIds: entry.selectedRecordIds.join(", "),
      mergedValues: JSON.stringify(entry.mergedValues),
    })),
  );
  const summary = XLSX.utils.json_to_sheet([
    {
      generatedAt: payload.generatedAt,
      cleanedRows: payload.cleanedRows.length,
      duplicateGroups: payload.duplicateGroups.length,
      mergedGroups: payload.duplicateGroups.filter((group) => group.status === "merged").length,
      ignoredGroups: payload.duplicateGroups.filter((group) => group.status === "ignored").length,
    },
  ]);

  XLSX.utils.book_append_sheet(workbook, cleaned, "Cleaned Data");
  XLSX.utils.book_append_sheet(workbook, duplicates, "Duplicate Report");
  XLSX.utils.book_append_sheet(workbook, audit, "Audit Trail");
  XLSX.utils.book_append_sheet(workbook, summary, "Summary");

  return workbook;
}

export function downloadBlob(content: BlobPart, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadWorkbook(payload: ExportPayload, filename = "cleaned-dataset.xlsx"): void {
  const workbook = buildCleanWorkbook(payload);
  XLSX.writeFile(workbook, filename, {
    compression: true,
  });
}
