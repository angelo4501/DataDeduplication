import { findDuplicates } from "@/services/dedupe-engine";
import type { DedupeSettings, ParsedRow, ProcessingProgress } from "@/types";

export type DedupeWorkerRequest = {
  type: "find-duplicates";
  rows: ParsedRow[];
  settings?: Partial<DedupeSettings>;
};

export type DedupeWorkerResponse =
  | {
      type: "progress";
      progress: ProcessingProgress;
    }
  | {
      type: "result";
      result: Awaited<ReturnType<typeof findDuplicates>>;
    }
  | {
      type: "error";
      error: string;
    };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<DedupeWorkerRequest>) => void | Promise<void>) | null;
  postMessage: (message: DedupeWorkerResponse) => void;
};

workerScope.onmessage = async (event: MessageEvent<DedupeWorkerRequest>) => {
  if (event.data.type !== "find-duplicates") {
    return;
  }

  try {
    const result = await findDuplicates(event.data.rows, event.data.settings, (progress) => {
      workerScope.postMessage({
        type: "progress",
        progress,
      } satisfies DedupeWorkerResponse);
    });

    workerScope.postMessage({
      type: "result",
      result,
    } satisfies DedupeWorkerResponse);
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "Unknown duplicate detection error",
    } satisfies DedupeWorkerResponse);
  }
};

export {};
