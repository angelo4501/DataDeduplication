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

export type DedupeAlgorithmPreset =
  | "enterprise_conservative"
  | "balanced"
  | "high_recall"
  | "custom";

export interface DedupeAlgorithmSettings {
  preset: DedupeAlgorithmPreset;
  namePrefixLength: number;
  exactPrefixLength: number;
  enablePhoneticBlocking: boolean;
  enableAddressTokenBlocking: boolean;
  enableCrossBlockFallback: boolean;
  fallbackModulo: number;
  missingValuePenalty: number;
  disagreementPenalty: number;
  strongMatchBoost: number;
  strongMatchThreshold: number;
  lowSimilarityThreshold: number;
  requiredFieldMinScore: number;
  mandatoryFieldMismatchCap: number;
  requireMandatoryFieldsForExact: boolean;
  minimumExactFields: number;
  minimumHighConfidenceFields: number;
  minimumCandidateReasons: number;
  maxCandidatePairsPerRecord: number;
  enableTransitiveClustering: boolean;
}

export interface DedupeSettings {
  fields: FieldWeight[];
  thresholds: DedupeThresholds;
  algorithm: DedupeAlgorithmSettings;
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
  algorithm: {
    preset: "enterprise_conservative",
    namePrefixLength: 6,
    exactPrefixLength: 12,
    enablePhoneticBlocking: true,
    enableAddressTokenBlocking: true,
    enableCrossBlockFallback: true,
    fallbackModulo: 97,
    missingValuePenalty: 18,
    disagreementPenalty: 12,
    strongMatchBoost: 3,
    strongMatchThreshold: 92,
    lowSimilarityThreshold: 35,
    requiredFieldMinScore: 82,
    mandatoryFieldMismatchCap: 69,
    requireMandatoryFieldsForExact: true,
    minimumExactFields: 3,
    minimumHighConfidenceFields: 2,
    minimumCandidateReasons: 2,
    maxCandidatePairsPerRecord: 2500,
    enableTransitiveClustering: true,
  },
  blockFields: ["lastName", "birthdate"],
  maxBlockSize: 600,
  chunkSize: 1000,
};

export const DEDUPE_ALGORITHM_PRESETS: Record<
  Exclude<DedupeAlgorithmPreset, "custom">,
  DedupeAlgorithmSettings
> = {
  enterprise_conservative: DEFAULT_DEDUPE_SETTINGS.algorithm,
  balanced: {
    ...DEFAULT_DEDUPE_SETTINGS.algorithm,
    preset: "balanced",
    missingValuePenalty: 12,
    disagreementPenalty: 8,
    strongMatchBoost: 4,
    requiredFieldMinScore: 76,
    mandatoryFieldMismatchCap: 74,
    minimumExactFields: 3,
    minimumHighConfidenceFields: 2,
    maxCandidatePairsPerRecord: 3500,
  },
  high_recall: {
    ...DEFAULT_DEDUPE_SETTINGS.algorithm,
    preset: "high_recall",
    namePrefixLength: 4,
    exactPrefixLength: 8,
    missingValuePenalty: 8,
    disagreementPenalty: 5,
    strongMatchBoost: 5,
    strongMatchThreshold: 88,
    requiredFieldMinScore: 70,
    mandatoryFieldMismatchCap: 79,
    minimumExactFields: 2,
    minimumHighConfidenceFields: 1,
    minimumCandidateReasons: 1,
    maxCandidatePairsPerRecord: 5000,
  },
};
