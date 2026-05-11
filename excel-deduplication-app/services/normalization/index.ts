import type { CellValue, FieldWeight, ParsedRow } from "@/types";

const COMMON_ADDRESS_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bstreet\b/g, "st"],
  [/\bst\.\b/g, "st"],
  [/\bavenue\b/g, "ave"],
  [/\bave\.\b/g, "ave"],
  [/\broad\b/g, "rd"],
  [/\brd\.\b/g, "rd"],
  [/\bbarangay\b/g, "brgy"],
  [/\bbrgy\.\b/g, "brgy"],
  [/\bapartment\b/g, "apt"],
  [/\bunit\b/g, "unit"],
];

export function normalizeString(value: CellValue | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const raw = value instanceof Date ? value.toISOString() : String(value);

  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}\s@.+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeName(value: CellValue | undefined): string {
  return normalizeString(value)
    .replace(/\b(jr|sr|ii|iii|iv|md|phd)\b/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhone(value: CellValue | undefined): string {
  const digits = normalizeString(value).replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("00") && digits.length > 10) {
    return normalizePhone(digits.slice(2));
  }

  if (digits.startsWith("63") && digits.length === 12) {
    return digits.slice(2);
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return digits.slice(1);
  }

  if (digits.length > 10 && digits.startsWith("1")) {
    return digits.slice(-10);
  }

  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function normalizeDate(value: CellValue | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + value * 86_400_000);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }

  const normalized = normalizeString(value);
  const parsed = Date.parse(normalized);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  const parts = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!parts) {
    return normalized;
  }

  const [, first, second, yearPart] = parts;
  const year = yearPart.length === 2 ? `19${yearPart}` : yearPart;
  const month = Number(first) > 12 ? second : first;
  const day = Number(first) > 12 ? first : second;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return Number.isNaN(date.getTime()) ? normalized : date.toISOString().slice(0, 10);
}

export function normalizeAddress(value: CellValue | undefined): string {
  let normalized = normalizeString(value).replace(/[^\p{L}\p{N}\s#-]/gu, " ");

  for (const [pattern, replacement] of COMMON_ADDRESS_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

export function normalizeByKind(value: CellValue | undefined, kind: FieldWeight["kind"]): string {
  switch (kind) {
    case "phone":
      return normalizePhone(value);
    case "date":
      return normalizeDate(value);
    case "address":
      return normalizeAddress(value);
    case "name":
      return normalizeName(value);
    case "exact":
    case "string":
    default:
      return normalizeString(value);
  }
}

export function normalizeRow(row: ParsedRow, fields: FieldWeight[]): ParsedRow {
  const normalized = fields.reduce<Record<string, string>>((accumulator, field) => {
    accumulator[field.field] = normalizeByKind(row.values[field.field], field.kind);
    return accumulator;
  }, {});

  return {
    ...row,
    normalized,
  };
}
