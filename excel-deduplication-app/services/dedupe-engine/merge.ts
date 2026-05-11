import { normalizePhone, normalizeString } from "@/services/normalization";
import type { DuplicateGroup, MergeAuditEntry, ParsedRow, RowValues } from "@/types";

function valueScore(key: string, value: unknown): number {
  const normalized = normalizeString(String(value ?? ""));
  if (!normalized) {
    return 0;
  }

  let score = 10;
  if (/address|street|location/i.test(key)) {
    score += normalized.length;
  }
  if (/phone|mobile|contact/i.test(key) && normalizePhone(String(value)).length >= 10) {
    score += 40;
  }
  if (/updated|modified|date/i.test(key)) {
    const timestamp = Date.parse(String(value));
    if (!Number.isNaN(timestamp)) {
      score += Math.min(50, timestamp / 1_000_000_000_000);
    }
  }
  return score;
}

export function mergeRecords(
  group: DuplicateGroup,
  overrides: RowValues = {},
  strategy: "auto" | "manual" = Object.keys(overrides).length > 0 ? "manual" : "auto",
): { record: ParsedRow; audit: MergeAuditEntry } {
  const allKeys = new Set(group.records.flatMap((record) => Object.keys(record.values)));
  const mergedValues: RowValues = {};

  for (const key of allKeys) {
    const best = group.records
      .map((record) => record.values[key])
      .filter((value) => normalizeString(String(value ?? "")))
      .sort((left, right) => valueScore(key, right) - valueScore(key, left))[0];

    mergedValues[key] = best ?? null;
  }

  Object.assign(mergedValues, overrides);

  const record: ParsedRow = {
    ...group.records[0],
    id: `merged-${group.id}`,
    values: mergedValues,
  };

  return {
    record,
    audit: {
      id: `audit-${group.id}-${Date.now()}`,
      groupId: group.id,
      timestamp: new Date().toISOString(),
      strategy,
      selectedRecordIds: group.recordIds,
      mergedValues,
    },
  };
}

export function removeMergedDuplicates(rows: ParsedRow[], group: DuplicateGroup, mergedRecord: ParsedRow): ParsedRow[] {
  const duplicateIds = new Set(group.recordIds);
  return [mergedRecord, ...rows.filter((row) => !duplicateIds.has(row.id))];
}
