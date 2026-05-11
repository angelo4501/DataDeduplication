const SUPPORTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const SUPPORTED_MIME_TYPES = [
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "",
];

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateUploadFile(file: File, maxBytes = 75 * 1024 * 1024): FileValidationResult {
  const errors: string[] = [];
  const lowerName = file.name.toLowerCase();
  const hasSupportedExtension = SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
  const hasSupportedMimeType = SUPPORTED_MIME_TYPES.includes(file.type);

  if (!hasSupportedExtension) {
    errors.push("Unsupported file type. Upload .xlsx, .xls, or .csv files.");
  }

  if (!hasSupportedMimeType) {
    errors.push(`Unexpected MIME type: ${file.type || "unknown"}.`);
  }

  if (file.size <= 0) {
    errors.push("The file is empty.");
  }

  if (file.size > maxBytes) {
    errors.push(`File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB upload limit.`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function escapeCsvFormula(value: unknown): string {
  const text = String(value ?? "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}
