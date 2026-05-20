"use client";

import { create } from "zustand";

import { mergeRecords, removeMergedDuplicates } from "@/services/dedupe-engine/merge";
import { getSelectedRows } from "@/services/parser/excel-parser";
import type {
  AnalyticsSummary,
  DedupeResult,
  DedupeSettings,
  DuplicateGroup,
  MergeAuditEntry,
  ParsedFile,
  ParsedRow,
  ProcessingProgress,
} from "@/types";
import { DEFAULT_DEDUPE_SETTINGS } from "@/types";

interface DedupeStore {
  files: ParsedFile[];
  rows: ParsedRow[];
  cleanedRows: ParsedRow[];
  duplicateGroups: DuplicateGroup[];
  auditTrail: MergeAuditEntry[];
  settings: DedupeSettings;
  analytics?: AnalyticsSummary;
  progress: ProcessingProgress;
  addFiles: (files: ParsedFile[]) => void;
  removeFile: (fileId: string) => void;
  selectSheet: (fileId: string, sheetId: string) => void;
  setDedupeResult: (result: DedupeResult) => void;
  setProgress: (progress: ProcessingProgress) => void;
  mergeGroup: (groupId: string, overrides?: Record<string, string>, selectedRecordIds?: string[]) => void;
  ignoreGroup: (groupId: string) => void;
  markUnique: (groupId: string) => void;
  approveAll: () => void;
  updateSettings: (settings: Partial<DedupeSettings>) => void;
  reset: () => void;
}

function recomputeRows(files: ParsedFile[]): ParsedRow[] {
  return getSelectedRows(files);
}

export const useDedupeStore = create<DedupeStore>((set, get) => ({
  files: [],
  rows: [],
  cleanedRows: [],
  duplicateGroups: [],
  auditTrail: [],
  settings: DEFAULT_DEDUPE_SETTINGS,
  progress: {
    phase: "idle",
    processed: 0,
    total: 0,
    message: "Ready",
  },
  addFiles: (incomingFiles) =>
    set((state) => {
      const files = [...state.files, ...incomingFiles];
      const rows = recomputeRows(files);
      return {
        files,
        rows,
        cleanedRows: rows,
      };
    }),
  removeFile: (fileId) =>
    set((state) => {
      const files = state.files.filter((file) => file.id !== fileId);
      const rows = recomputeRows(files);
      return {
        files,
        rows,
        cleanedRows: rows,
      };
    }),
  selectSheet: (fileId, sheetId) =>
    set((state) => {
      const files = state.files.map((file) =>
        file.id === fileId ? { ...file, selectedSheetId: sheetId } : file,
      );
      const rows = recomputeRows(files);
      return {
        files,
        rows,
        cleanedRows: rows,
      };
    }),
  setDedupeResult: (result) =>
    set({
      duplicateGroups: result.groups,
      analytics: result.analytics,
      progress: {
        phase: "complete",
        processed: result.analytics.totalRecords,
        total: result.analytics.totalRecords,
        message: `Found ${result.analytics.duplicateGroups} duplicate groups`,
      },
    }),
  setProgress: (progress) => set({ progress }),
  mergeGroup: (groupId, overrides = {}, selectedRecordIds) =>
    set((state) => {
      const group = state.duplicateGroups.find((candidate) => candidate.id === groupId);
      if (!group) {
        return state;
      }

      const validSelectedRecordIds = selectedRecordIds?.filter((recordId) => group.recordIds.includes(recordId));
      if (validSelectedRecordIds && validSelectedRecordIds.length < 2) {
        return state;
      }

      const strategy = Object.keys(overrides).length > 0 || validSelectedRecordIds ? "manual" : "auto";
      const { record, audit } = mergeRecords(group, overrides, strategy, validSelectedRecordIds ?? group.recordIds);
      const duplicateGroups = state.duplicateGroups.map((candidate) =>
        candidate.id === groupId
          ? {
              ...candidate,
              status: "merged" as const,
              mergedRecord: record,
            }
          : candidate,
      );

      return {
        duplicateGroups,
        cleanedRows: removeMergedDuplicates(state.cleanedRows, group, record, validSelectedRecordIds ?? group.recordIds),
        auditTrail: [...state.auditTrail, audit],
      };
    }),
  ignoreGroup: (groupId) =>
    set((state) => ({
      duplicateGroups: state.duplicateGroups.map((group) =>
        group.id === groupId ? { ...group, status: "ignored" as const } : group,
      ),
    })),
  markUnique: (groupId) =>
    set((state) => ({
      duplicateGroups: state.duplicateGroups.map((group) =>
        group.id === groupId ? { ...group, status: "unique" as const } : group,
      ),
    })),
  approveAll: () => {
    const pending = get().duplicateGroups.filter((group) => group.status === "pending");
    for (const group of pending) {
      get().mergeGroup(group.id);
    }
  },
  updateSettings: (settings) =>
    set((state) => ({
      settings: {
        ...state.settings,
        ...settings,
        thresholds: {
          ...state.settings.thresholds,
          ...settings.thresholds,
        },
        algorithm: {
          ...state.settings.algorithm,
          ...settings.algorithm,
        },
        fields: settings.fields ?? state.settings.fields,
      },
    })),
  reset: () =>
    set({
      files: [],
      rows: [],
      cleanedRows: [],
      duplicateGroups: [],
      auditTrail: [],
      analytics: undefined,
      progress: {
        phase: "idle",
        processed: 0,
        total: 0,
        message: "Ready",
      },
    }),
}));
