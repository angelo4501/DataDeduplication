export type CellValue = string | number | boolean | Date | null;

export type RowValues = Record<string, CellValue>;

export interface ParsedRow {
  id: string;
  sourceFileId: string;
  sheetId: string;
  sheetName: string;
  rowNumber: number;
  values: RowValues;
  normalized?: Record<string, string>;
  malformed?: boolean;
  errors?: string[];
}

export interface ParsedSheet {
  id: string;
  fileId: string;
  name: string;
  headers: string[];
  rowCount: number;
  malformedRows: number;
  rows: ParsedRow[];
  preview: ParsedRow[];
}

export interface ParsedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  sheets: ParsedSheet[];
  selectedSheetId?: string;
  errors: string[];
}

export type MatchFieldKind = "name" | "string" | "phone" | "date" | "address" | "exact";

export interface FieldWeight {
  field: string;
  label: string;
  weight: number;
  kind: MatchFieldKind;
  aliases?: string[];
  required?: boolean;
}

export interface DedupeThresholds {
  exact: number;
  high: number;
  possible: number;
}

export interface DedupeSettings {
  fields: FieldWeight[];
  thresholds: DedupeThresholds;
  blockFields: string[];
  maxBlockSize: number;
  chunkSize: number;
}

export type DuplicateClassification =
  | "exact"
  | "highly_probable"
  | "possible"
  | "unique";

export interface MatchReason {
  field: string;
  label: string;
  score: number;
  weight: number;
  weightedScore: number;
  left: string;
  right: string;
  strategy: string;
}

export interface DuplicateCandidate {
  id: string;
  sourceId: string;
  targetId: string;
  score: number;
  classification: DuplicateClassification;
  reasons: MatchReason[];
}

export type ReviewStatus = "pending" | "merged" | "ignored" | "unique";

export interface DuplicateGroup {
  id: string;
  recordIds: string[];
  records: ParsedRow[];
  confidence: number;
  classification: DuplicateClassification;
  reasons: MatchReason[];
  status: ReviewStatus;
  mergedRecord?: ParsedRow;
}

export interface MergeAuditEntry {
  id: string;
  groupId: string;
  timestamp: string;
  strategy: "auto" | "manual";
  selectedRecordIds: string[];
  mergedValues: RowValues;
  notes?: string;
}

export interface ExportPayload {
  cleanedRows: ParsedRow[];
  duplicateGroups: DuplicateGroup[];
  auditTrail: MergeAuditEntry[];
  generatedAt: string;
}

export interface ProcessingProgress {
  phase: "idle" | "parsing" | "normalizing" | "matching" | "clustering" | "complete" | "error";
  processed: number;
  total: number;
  message: string;
}

export interface AnalyticsSummary {
  totalRecords: number;
  duplicateRecords: number;
  duplicateGroups: number;
  duplicatePercentage: number;
  exactGroups: number;
  highProbabilityGroups: number;
  possibleGroups: number;
  processingTimeMs: number;
}

export interface DedupeResult {
  groups: DuplicateGroup[];
  candidates: DuplicateCandidate[];
  analytics: AnalyticsSummary;
  processingTimeMs: number;
}

export const DEFAULT_DEDUPE_SETTINGS: DedupeSettings = {
  fields: [
    {
      field: "lastName",
      label: "Last Name",
      weight: 0.35,
      kind: "name",
      aliases: ["last name", "lastname", "surname", "family name"],
      required: true,
    },
    {
      field: "firstName",
      label: "First Name",
      weight: 0.25,
      kind: "name",
      aliases: ["first name", "firstname", "given name"],
      required: true,
    },
    {
      field: "birthdate",
      label: "Birthdate",
      weight: 0.25,
      kind: "date",
      aliases: ["birth date", "date of birth", "dob", "birthday"],
    },
    {
      field: "middleName",
      label: "Middle Name",
      weight: 0.1,
      kind: "name",
      aliases: ["middle name", "middlename", "middle initial", "mi"],
    },
    {
      field: "address",
      label: "Address",
      weight: 0.05,
      kind: "address",
      aliases: ["home address", "street address", "mailing address", "location"],
    },
  ],
  thresholds: {
    exact: 95,
    high: 85,
    possible: 70,
  },
  blockFields: ["lastName", "birthdate"],
  maxBlockSize: 600,
  chunkSize: 1000,
};
