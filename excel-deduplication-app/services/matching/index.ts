import levenshtein from "fast-levenshtein";
import Fuse from "fuse.js";
import stringSimilarity from "string-similarity";

import { normalizeAddress, normalizeName, normalizeString } from "@/services/normalization";
import type { ParsedRow } from "@/types";

const NICKNAMES: Record<string, string[]> = {
  alex: ["alexander", "alexandra"],
  ben: ["benjamin", "benedicto"],
  beth: ["elizabeth"],
  bob: ["robert", "roberto"],
  chris: ["christopher", "christian", "christine"],
  dave: ["david"],
  ed: ["edward", "eduardo", "edwin"],
  liz: ["elizabeth"],
  mike: ["michael", "miguel"],
  nick: ["nicholas"],
  pat: ["patrick", "patricia"],
  rob: ["robert", "roberto"],
  sam: ["samuel", "samantha"],
  tony: ["anthony", "antonio"],
  will: ["william"],
};

export interface SimilarityResult {
  score: number;
  strategy: string;
}

export function jaroWinkler(left: string, right: string): number {
  if (left === right) {
    return 1;
  }

  const leftLength = left.length;
  const rightLength = right.length;
  if (leftLength === 0 || rightLength === 0) {
    return 0;
  }

  const matchDistance = Math.floor(Math.max(leftLength, rightLength) / 2) - 1;
  const leftMatches = new Array<boolean>(leftLength).fill(false);
  const rightMatches = new Array<boolean>(rightLength).fill(false);

  let matches = 0;
  for (let index = 0; index < leftLength; index += 1) {
    const start = Math.max(0, index - matchDistance);
    const end = Math.min(index + matchDistance + 1, rightLength);

    for (let candidate = start; candidate < end; candidate += 1) {
      if (rightMatches[candidate] || left[index] !== right[candidate]) {
        continue;
      }

      leftMatches[index] = true;
      rightMatches[candidate] = true;
      matches += 1;
      break;
    }
  }

  if (matches === 0) {
    return 0;
  }

  let transpositions = 0;
  let rightIndex = 0;

  for (let leftIndex = 0; leftIndex < leftLength; leftIndex += 1) {
    if (!leftMatches[leftIndex]) {
      continue;
    }

    while (!rightMatches[rightIndex]) {
      rightIndex += 1;
    }

    if (left[leftIndex] !== right[rightIndex]) {
      transpositions += 1;
    }

    rightIndex += 1;
  }

  const jaro =
    (matches / leftLength +
      matches / rightLength +
      (matches - transpositions / 2) / matches) /
    3;

  let prefix = 0;
  for (let index = 0; index < Math.min(4, leftLength, rightLength); index += 1) {
    if (left[index] !== right[index]) {
      break;
    }
    prefix += 1;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));

  if (leftTokens.size === 0 && rightTokens.size === 0) {
    return 1;
  }

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;

  return union === 0 ? 0 : intersection / union;
}

function nicknameSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  const leftFamily = NICKNAMES[normalizedLeft] ?? [];
  const rightFamily = NICKNAMES[normalizedRight] ?? [];

  if (leftFamily.includes(normalizedRight) || rightFamily.includes(normalizedLeft)) {
    return 0.94;
  }

  return 0;
}

export function calculateSimilarity(
  leftValue: unknown,
  rightValue: unknown,
  options: { normalize?: boolean; exactBoost?: boolean } = {},
): SimilarityResult {
  const left = options.normalize === false ? String(leftValue ?? "") : normalizeString(String(leftValue ?? ""));
  const right = options.normalize === false ? String(rightValue ?? "") : normalizeString(String(rightValue ?? ""));

  if (!left && !right) {
    return { score: 100, strategy: "both-empty" };
  }

  if (!left || !right) {
    return { score: 0, strategy: "missing-value" };
  }

  if (left === right) {
    return { score: 100, strategy: "exact" };
  }

  const maxLength = Math.max(left.length, right.length);
  const editSimilarity = maxLength === 0 ? 1 : 1 - levenshtein.get(left, right) / maxLength;
  const jaroScore = jaroWinkler(left, right);
  const tokenScore = tokenSimilarity(left, right);
  const diceScore = stringSimilarity.compareTwoStrings(left, right);
  const best = Math.max(editSimilarity, jaroScore, tokenScore, diceScore);

  return {
    score: Math.round(best * 100),
    strategy:
      best === tokenScore
        ? "token"
        : best === jaroScore
          ? "jaro-winkler"
          : best === diceScore
            ? "dice"
            : "levenshtein",
  };
}

export function calculateNameSimilarity(leftValue: unknown, rightValue: unknown): SimilarityResult {
  const left = normalizeName(String(leftValue ?? ""));
  const right = normalizeName(String(rightValue ?? ""));

  if (!left || !right) {
    return { score: left === right ? 100 : 0, strategy: left === right ? "both-empty" : "missing-name" };
  }

  const nicknameScore = nicknameSimilarity(left, right);
  const base = calculateSimilarity(left, right, { normalize: false });
  const swapped = calculateSwappedNameSimilarity(left, right);
  const bestScore = Math.max(base.score, Math.round(nicknameScore * 100), swapped.score);

  return {
    score: bestScore,
    strategy:
      bestScore === swapped.score && swapped.score > base.score
        ? "swapped-name"
        : bestScore === Math.round(nicknameScore * 100)
          ? "nickname"
          : base.strategy,
  };
}

export function calculateSwappedNameSimilarity(leftValue: unknown, rightValue: unknown): SimilarityResult {
  const leftTokens = normalizeName(String(leftValue ?? "")).split(" ").filter(Boolean);
  const rightTokens = normalizeName(String(rightValue ?? "")).split(" ").filter(Boolean);

  if (leftTokens.length < 2 || rightTokens.length < 2) {
    return { score: 0, strategy: "not-swapped" };
  }

  const swappedLeft = [...leftTokens].reverse().join(" ");
  return {
    score: calculateSimilarity(swappedLeft, rightTokens.join(" "), { normalize: false }).score,
    strategy: "swapped-name",
  };
}

export function calculateAddressSimilarity(leftValue: unknown, rightValue: unknown): SimilarityResult {
  const left = normalizeAddress(String(leftValue ?? ""));
  const right = normalizeAddress(String(rightValue ?? ""));

  if (!left || !right) {
    return { score: left === right ? 100 : 0, strategy: left === right ? "both-empty" : "missing-address" };
  }

  const base = calculateSimilarity(left, right, { normalize: false });
  const tokenScore = Math.round(tokenSimilarity(left, right) * 100);
  const score = Math.max(base.score, tokenScore);

  return {
    score,
    strategy: score === tokenScore ? "address-token" : base.strategy,
  };
}

export function createFuseIndex(records: ParsedRow[], keys: string[]): Fuse<ParsedRow> {
  return new Fuse(records, {
    includeScore: true,
    threshold: 0.25,
    ignoreLocation: true,
    keys: keys.map((key) => `normalized.${key}`),
  });
}
