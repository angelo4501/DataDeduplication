import Papa from "papaparse";
import * as XLSX from "xlsx";

import type { CellValue, ParsedFile, ParsedRow, ParsedSheet } from "@/types";
import { validateUploadFile } from "@/utils/security";

export interface ParseOptions {
  maxBytes?: number;
  previewRows?: number;
  chunkSize?: number;
}

type MatrixRow = CellValue[];

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function asCellValue(value: unknown): CellValue {
  if (value === undefined || value === "") {
    return null;
  }
  if (value instanceof Date || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

function detectHeaderIndex(rows: MatrixRow[]): number {
  const sample = rows.slice(0, Math.min(rows.length, 25));
  let bestIndex = 0;
  let bestScore = -1;

  sample.forEach((row, index) => {
    const nonEmpty = row.filter((cell) => String(cell ?? "").trim()).length;
    const stringCells = row.filter((cell) => Number.isNaN(Number(cell)) && String(cell ?? "").trim()).length;
    const uniqueCells = new Set(row.map((cell) => String(cell ?? "").trim().toLowerCase()).filter(Boolean)).size;
    const score = nonEmpty + stringCells + uniqueCells;

    if (nonEmpty >= 2 && score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function makeUniqueHeaders(row: MatrixRow): string[] {
  const seen = new Map<string, number>();

  return row.map((cell, index) => {
    const base = String(cell ?? "").trim() || `Column ${index + 1}`;
    const count = seen.get(base.toLowerCase()) ?? 0;
    seen.set(base.toLowerCase(), count + 1);
    return count === 0 ? base : `${base} ${count + 1}`;
  });
}

function matrixToSheet(params: {
  matrix: MatrixRow[];
  fileId: string;
  sheetName: string;
  sheetIndex: number;
  previewRows: number;
}): ParsedSheet {
  const { matrix, fileId, sheetName, sheetIndex, previewRows } = params;
  const headerIndex = detectHeaderIndex(matrix);
  const headers = makeUniqueHeaders(matrix[headerIndex] ?? []);
  const dataRows = matrix.slice(headerIndex + 1);
  const sheetId = `${fileId}-sheet-${sheetIndex}`;
  let malformedRows = 0;

  const rows: ParsedRow[] = dataRows
    .map((row, rowIndex) => {
      const values = headers.reduce<Record<string, CellValue>>((accumulator, header, columnIndex) => {
        accumulator[header] = asCellValue(row[columnIndex]);
        return accumulator;
      }, {});
      const nonEmptyCells = row.filter((cell) => String(cell ?? "").trim()).length;
      const malformed = nonEmptyCells > 0 && row.length !== headers.length;

      if (malformed) {
        malformedRows += 1;
      }

      return {
        id: `${sheetId}-row-${rowIndex + 1}`,
        sourceFileId: fileId,
        sheetId,
        sheetName,
        rowNumber: headerIndex + rowIndex + 2,
        values,
        malformed,
        errors: malformed ? ["Row column count differs from detected header count."] : [],
      };
    })
    .filter((row) => Object.values(row.values).some((value) => String(value ?? "").trim()));

  return {
    id: sheetId,
    fileId,
    name: sheetName,
    headers,
    rowCount: rows.length,
    malformedRows,
    rows,
    preview: rows.slice(0, previewRows),
  };
}

async function parseWorkbook(file: File, options: Required<ParseOptions>, fileId: string): Promise<ParsedSheet[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    dense: true,
    cellDates: true,
    WTF: false,
  });

  return workbook.SheetNames.map((sheetName, sheetIndex) => {
    const worksheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<CellValue[]>(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: false,
    });

    return matrixToSheet({
      matrix,
      fileId,
      sheetName,
      sheetIndex,
      previewRows: options.previewRows,
    });
  });
}

async function parseCsv(file: File, options: Required<ParseOptions>, fileId: string): Promise<ParsedSheet[]> {
  return new Promise((resolve, reject) => {
    const rows: MatrixRow[] = [];

    Papa.parse<CellValue[]>(file, {
      worker: true,
      skipEmptyLines: false,
      chunkSize: options.chunkSize,
      chunk(results) {
        rows.push(...results.data);
      },
      complete() {
        resolve([
          matrixToSheet({
            matrix: rows,
            fileId,
            sheetName: "CSV Import",
            sheetIndex: 0,
            previewRows: options.previewRows,
          }),
        ]);
      },
      error(error) {
        reject(error);
      },
    });
  });
}

export async function parseFile(file: File, parseOptions: ParseOptions = {}): Promise<ParsedFile> {
  const options: Required<ParseOptions> = {
    maxBytes: parseOptions.maxBytes ?? 75 * 1024 * 1024,
    previewRows: parseOptions.previewRows ?? 10,
    chunkSize: parseOptions.chunkSize ?? 1024 * 256,
  };
  const validation = validateUploadFile(file, options.maxBytes);
  const fileId = createId("file");

  if (!validation.valid) {
    return {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
      sheets: [],
      errors: validation.errors,
    };
  }

  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const sheets = isCsv ? await parseCsv(file, options, fileId) : await parseWorkbook(file, options, fileId);

  return {
    id: fileId,
    name: file.name,
    size: file.size,
    type: file.type,
    uploadedAt: new Date().toISOString(),
    sheets,
    selectedSheetId: sheets[0]?.id,
    errors: [],
  };
}

export function getSelectedRows(files: ParsedFile[]): ParsedRow[] {
  return files.flatMap((file) => {
    const selectedSheet = file.sheets.find((sheet) => sheet.id === file.selectedSheetId) ?? file.sheets[0];
    return selectedSheet?.rows ?? [];
  });
}
