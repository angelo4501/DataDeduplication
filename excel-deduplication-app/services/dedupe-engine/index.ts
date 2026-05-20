import {
  calculateAddressSimilarity,
  calculateNameSimilarity,
  calculateSimilarity,
} from "@/services/matching";
import { normalizeByKind, normalizeString } from "@/services/normalization";
import type {
  AnalyticsSummary,
  DedupeResult,
  DedupeSettings,
  DuplicateCandidate,
  DuplicateClassification,
  DuplicateGroup,
  FieldWeight,
  MatchReason,
  ParsedRow,
  ProcessingProgress,
} from "@/types";
import { DEFAULT_DEDUPE_SETTINGS } from "@/types";

type ProgressHandler = (progress: ProcessingProgress) => void;

class UnionFind {
  private readonly parent = new Map<string, string>();

  constructor(ids: string[]) {
    for (const id of ids) {
      this.parent.set(id, id);
    }
  }

  find(id: string): string {
    const parent = this.parent.get(id) ?? id;
    if (parent === id) {
      return id;
    }

    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) {
      this.parent.set(rightRoot, leftRoot);
    }
  }
}

function mergeSettings(settings?: Partial<DedupeSettings>): DedupeSettings {
  return {
    ...DEFAULT_DEDUPE_SETTINGS,
    ...settings,
    fields: settings?.fields ?? DEFAULT_DEDUPE_SETTINGS.fields,
    thresholds: {
      ...DEFAULT_DEDUPE_SETTINGS.thresholds,
      ...settings?.thresholds,
    },
    algorithm: {
      ...DEFAULT_DEDUPE_SETTINGS.algorithm,
      ...settings?.algorithm,
    },
  };
}

function headerCandidates(field: FieldWeight): string[] {
  return [field.field, field.label, ...(field.aliases ?? [])].map(normalizeString);
}

export function resolveFieldValue(row: ParsedRow, field: FieldWeight): string {
  const normalizedHeaders = new Map(
    Object.entries(row.values).map(([key, value]) => [normalizeString(key), value]),
  );

  for (const candidate of headerCandidates(field)) {
    if (normalizedHeaders.has(candidate)) {
      return String(normalizedHeaders.get(candidate) ?? "");
    }
  }

  return "";
}

function classifyScore(
  score: number,
  reasons: MatchReason[],
  settings: DedupeSettings,
): DuplicateClassification {
  const strongReasons = reasons.filter(
    (reason) => reason.score >= settings.algorithm.strongMatchThreshold,
  ).length;
  const exactReasons = reasons.filter((reason) => reason.score >= 99).length;

  if (score >= settings.thresholds.exact) {
    if (
      exactReasons >= settings.algorithm.minimumExactFields &&
      (!settings.algorithm.requireMandatoryFieldsForExact ||
        requiredFieldsPass(reasons, settings))
    ) {
      return "exact";
    }
    return strongReasons >= settings.algorithm.minimumHighConfidenceFields
      ? "highly_probable"
      : "possible";
  }
  if (score >= settings.thresholds.high) {
    return strongReasons >= settings.algorithm.minimumHighConfidenceFields
      ? "highly_probable"
      : "possible";
  }
  if (score >= settings.thresholds.possible) {
    return "possible";
  }
  return "unique";
}

function fieldSimilarity(field: FieldWeight, left: string, right: string) {
  if (field.kind === "name") {
    return calculateNameSimilarity(left, right);
  }

  if (field.kind === "address") {
    return calculateAddressSimilarity(left, right);
  }

  if (field.kind === "exact" || field.kind === "date" || field.kind === "phone") {
    const normalizedLeft = normalizeByKind(left, field.kind);
    const normalizedRight = normalizeByKind(right, field.kind);
    return {
      score: normalizedLeft && normalizedRight && normalizedLeft === normalizedRight ? 100 : 0,
      strategy:
        normalizedLeft && normalizedRight && normalizedLeft === normalizedRight
          ? `${field.kind}-exact`
          : `${field.kind}-mismatch`,
    };
  }

  return calculateSimilarity(left, right);
}

function requiredFieldsPass(reasons: MatchReason[], settings: DedupeSettings): boolean {
  const requiredFields = new Set(
    settings.fields.filter((field) => field.required).map((field) => field.field),
  );
  if (requiredFields.size === 0) {
    return true;
  }

  return reasons
    .filter((reason) => requiredFields.has(reason.field))
    .every((reason) => reason.score >= settings.algorithm.requiredFieldMinScore);
}

function calibratedScore(rawScore: number, reasons: MatchReason[], settings: DedupeSettings): number {
  const strongReasons = reasons.filter(
    (reason) => reason.score >= settings.algorithm.strongMatchThreshold,
  ).length;
  const lowSimilarityReasons = reasons.filter(
    (reason) => reason.score > 0 && reason.score <= settings.algorithm.lowSimilarityThreshold,
  ).length;
  const requiredMismatch = !requiredFieldsPass(reasons, settings);
  const missingPenalties = reasons.filter((reason) => reason.strategy === "missing-value").length;

  let score = rawScore;
  score += Math.min(
    settings.algorithm.strongMatchBoost * strongReasons,
    settings.algorithm.strongMatchBoost * 4,
  );
  score -= lowSimilarityReasons * settings.algorithm.disagreementPenalty;
  score -= missingPenalties * settings.algorithm.missingValuePenalty;

  if (requiredMismatch) {
    score = Math.min(score, settings.algorithm.mandatoryFieldMismatchCap);
  }

  if (reasons.length < settings.algorithm.minimumCandidateReasons) {
    score = Math.min(score, settings.thresholds.possible - 1);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateWeightedScore(
  left: ParsedRow,
  right: ParsedRow,
  settings: DedupeSettings = DEFAULT_DEDUPE_SETTINGS,
): { score: number; reasons: MatchReason[] } {
  let weightedScore = 0;
  let denominator = 0;
  const reasons: MatchReason[] = [];

  for (const field of settings.fields) {
    const leftValue = resolveFieldValue(left, field);
    const rightValue = resolveFieldValue(right, field);
    const normalizedLeft = normalizeByKind(leftValue, field.kind);
    const normalizedRight = normalizeByKind(rightValue, field.kind);

    if (!normalizedLeft && !normalizedRight && !field.required) {
      continue;
    }

    denominator += field.weight;

    const similarity =
      !normalizedLeft || !normalizedRight
        ? { score: 0, strategy: "missing-value" }
        : fieldSimilarity(field, leftValue, rightValue);
    const contribution = similarity.score * field.weight;
    weightedScore += contribution;

    reasons.push({
      field: field.field,
      label: field.label,
      score: similarity.score,
      weight: field.weight,
      weightedScore: contribution,
      left: leftValue,
      right: rightValue,
      strategy: similarity.strategy,
    });
  }

  const rawScore = denominator === 0 ? 0 : Math.round(weightedScore / denominator);

  return {
    score: calibratedScore(rawScore, reasons, settings),
    reasons,
  };
}

function phoneticToken(value: string): string {
  const normalized = normalizeString(value).replace(/[^a-z]/g, "");
  if (!normalized) {
    return "";
  }

  const first = normalized[0];
  const encoded = normalized
    .slice(1)
    .replace(/[bfpv]/g, "1")
    .replace(/[cgjkqsxz]/g, "2")
    .replace(/[dt]/g, "3")
    .replace(/[l]/g, "4")
    .replace(/[mn]/g, "5")
    .replace(/[r]/g, "6")
    .replace(/[aeiouhwy]/g, "0")
    .replace(/(\d)\1+/g, "$1")
    .replace(/0/g, "");

  return `${first}${encoded}`.padEnd(4, "0").slice(0, 4);
}

function buildBlockingKeys(row: ParsedRow, settings: DedupeSettings): string[] {
  const keys = new Set<string>();
  const fieldMap = new Map(settings.fields.map((field) => [field.field, field]));

  for (const blockField of settings.blockFields) {
    const field = fieldMap.get(blockField);
    if (!field) {
      continue;
    }

    const normalized = normalizeByKind(resolveFieldValue(row, field), field.kind);
    if (normalized) {
      const prefixLength =
        field.kind === "name"
          ? settings.algorithm.namePrefixLength
          : settings.algorithm.exactPrefixLength;
      keys.add(`${blockField}:${normalized.slice(0, prefixLength)}`);

      if (settings.algorithm.enablePhoneticBlocking && field.kind === "name") {
        const phonetic = phoneticToken(normalized);
        if (phonetic) {
          keys.add(`${blockField}:phonetic:${phonetic}`);
        }
      }
    }
  }

  const nameFields = settings.fields.filter((field) => field.kind === "name");
  const compositeName = nameFields
    .map((field) =>
      normalizeByKind(resolveFieldValue(row, field), field.kind).slice(
        0,
        Math.max(2, settings.algorithm.namePrefixLength - 2),
      ),
    )
    .filter(Boolean)
    .join("|");
  if (compositeName) {
    keys.add(`name:${compositeName}`);
  }

  if (settings.algorithm.enableAddressTokenBlocking) {
    const addressField = settings.fields.find((field) => field.kind === "address");
    const address = addressField
      ? normalizeByKind(resolveFieldValue(row, addressField), addressField.kind)
      : "";
    const addressToken = address
      .split(" ")
      .find((token) => token.length >= 4 && !/^\d+$/.test(token));
    if (addressToken) {
      keys.add(`address:${addressToken.slice(0, settings.algorithm.exactPrefixLength)}`);
    }
  }

  if (settings.algorithm.enableCrossBlockFallback && keys.size < 2) {
    keys.add(`fallback:${row.rowNumber % settings.algorithm.fallbackModulo}`);
  }

  return keys.size > 0 ? [...keys] : [`fallback:${row.rowNumber % settings.algorithm.fallbackModulo}`];
}

function buildBlocks(rows: ParsedRow[], settings: DedupeSettings): Map<string, ParsedRow[]> {
  const blocks = new Map<string, ParsedRow[]>();

  for (const row of rows) {
    for (const key of buildBlockingKeys(row, settings)) {
      const bucket = blocks.get(key) ?? [];
      bucket.push(row);
      blocks.set(key, bucket);
    }
  }

  return blocks;
}

function candidateId(left: ParsedRow, right: ParsedRow): string {
  return [left.id, right.id].sort().join("__");
}

function buildAnalytics(
  totalRecords: number,
  groups: DuplicateGroup[],
  processingTimeMs: number,
): AnalyticsSummary {
  const duplicateRecords = new Set(groups.flatMap((group) => group.recordIds)).size;

  return {
    totalRecords,
    duplicateRecords,
    duplicateGroups: groups.length,
    duplicatePercentage: totalRecords === 0 ? 0 : Math.round((duplicateRecords / totalRecords) * 10_000) / 100,
    exactGroups: groups.filter((group) => group.classification === "exact").length,
    highProbabilityGroups: groups.filter((group) => group.classification === "highly_probable").length,
    possibleGroups: groups.filter((group) => group.classification === "possible").length,
    processingTimeMs,
  };
}

export function groupDuplicates(
  rows: ParsedRow[],
  candidates: DuplicateCandidate[],
  settings: DedupeSettings = DEFAULT_DEDUPE_SETTINGS,
): DuplicateGroup[] {
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const unionFind = new UnionFind(rows.map((row) => row.id));

  for (const candidate of candidates) {
    if (
      settings.algorithm.enableTransitiveClustering ||
      candidate.classification === "exact" ||
      candidate.classification === "highly_probable"
    ) {
      unionFind.union(candidate.sourceId, candidate.targetId);
    }
  }

  const groupedIds = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    const root = unionFind.find(candidate.sourceId);
    const bucket = groupedIds.get(root) ?? new Set<string>();
    bucket.add(candidate.sourceId);
    bucket.add(candidate.targetId);
    groupedIds.set(root, bucket);
  }

  return [...groupedIds.entries()]
    .map(([root, recordIds], index) => {
      const groupCandidates = candidates.filter(
        (candidate) => recordIds.has(candidate.sourceId) && recordIds.has(candidate.targetId),
      );
      const confidence = Math.max(...groupCandidates.map((candidate) => candidate.score));
      const bestCandidate = groupCandidates.find((candidate) => candidate.score === confidence) ?? groupCandidates[0];
      const records = [...recordIds].map((id) => rowById.get(id)).filter((row): row is ParsedRow => Boolean(row));

      return {
        id: `group-${index + 1}-${root}`,
        recordIds: [...recordIds],
        records,
        confidence,
        classification: bestCandidate.classification,
        reasons: bestCandidate.reasons,
        status: "pending" as const,
      };
    })
    .sort((left, right) => right.confidence - left.confidence);
}

export function clusterRecords(rows: ParsedRow[], candidates: DuplicateCandidate[]): DuplicateGroup[] {
  return groupDuplicates(rows, candidates);
}

export async function findDuplicates(
  rows: ParsedRow[],
  partialSettings?: Partial<DedupeSettings>,
  onProgress?: ProgressHandler,
): Promise<DedupeResult> {
  const startedAt = performance.now();
  const settings = mergeSettings(partialSettings);
  const seenPairs = new Set<string>();
  const pairCounts = new Map<string, number>();
  const candidates: DuplicateCandidate[] = [];
  const blocks = buildBlocks(rows, settings);
  let processed = 0;
  const totalPairsEstimate = [...blocks.values()].reduce(
    (total, block) => total + Math.min(block.length, settings.maxBlockSize) ** 2,
    0,
  );

  onProgress?.({
    phase: "matching",
    processed: 0,
    total: totalPairsEstimate,
    message: "Building blocking indexes",
  });

  for (const block of blocks.values()) {
    const limitedBlock = block.slice(0, settings.maxBlockSize);

    for (let leftIndex = 0; leftIndex < limitedBlock.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < limitedBlock.length; rightIndex += 1) {
        const left = limitedBlock[leftIndex];
        const right = limitedBlock[rightIndex];
        const id = candidateId(left, right);

        if (seenPairs.has(id)) {
          continue;
        }

        const leftCount = pairCounts.get(left.id) ?? 0;
        const rightCount = pairCounts.get(right.id) ?? 0;
        if (
          leftCount >= settings.algorithm.maxCandidatePairsPerRecord ||
          rightCount >= settings.algorithm.maxCandidatePairsPerRecord
        ) {
          continue;
        }

        seenPairs.add(id);
        pairCounts.set(left.id, leftCount + 1);
        pairCounts.set(right.id, rightCount + 1);
        const { score, reasons } = calculateWeightedScore(left, right, settings);
        const classification = classifyScore(score, reasons, settings);

        if (classification !== "unique") {
          candidates.push({
            id,
            sourceId: left.id,
            targetId: right.id,
            score,
            classification,
            reasons,
          });
        }

        processed += 1;
        if (processed % settings.chunkSize === 0) {
          onProgress?.({
            phase: "matching",
            processed,
            total: totalPairsEstimate,
            message: `Compared ${processed.toLocaleString()} candidate pairs`,
          });
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    }
  }

  onProgress?.({
    phase: "clustering",
    processed,
    total: Math.max(processed, 1),
    message: "Clustering duplicate records",
  });

  const groups = groupDuplicates(rows, candidates, settings);
  const processingTimeMs = Math.round(performance.now() - startedAt);
  const analytics = buildAnalytics(rows.length, groups, processingTimeMs);

  onProgress?.({
    phase: "complete",
    processed: rows.length,
    total: rows.length,
    message: "Duplicate detection complete",
  });

  return {
    groups,
    candidates,
    analytics,
    processingTimeMs,
  };
}
