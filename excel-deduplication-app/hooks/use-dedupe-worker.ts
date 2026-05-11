"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DedupeWorkerRequest, DedupeWorkerResponse } from "@/workers/dedupe.worker";
import type { DedupeResult, DedupeSettings, ParsedRow, ProcessingProgress } from "@/types";

export function useDedupeWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [progress, setProgress] = useState<ProcessingProgress>({
    phase: "idle",
    processed: 0,
    total: 0,
    message: "Ready",
  });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    workerRef.current = new Worker(new URL("../workers/dedupe.worker.ts", import.meta.url), {
      type: "module",
    });

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const runDedupe = useCallback((rows: ParsedRow[], settings?: Partial<DedupeSettings>) => {
    const worker = workerRef.current;

    if (!worker) {
      return Promise.reject(new Error("Dedupe worker is not available."));
    }

    setIsProcessing(true);

    return new Promise<DedupeResult>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<DedupeWorkerResponse>) => {
        if (event.data.type === "progress") {
          setProgress(event.data.progress);
        }

        if (event.data.type === "result") {
          setIsProcessing(false);
          resolve(event.data.result);
        }

        if (event.data.type === "error") {
          setIsProcessing(false);
          setProgress({
            phase: "error",
            processed: 0,
            total: rows.length,
            message: event.data.error,
          });
          reject(new Error(event.data.error));
        }
      };

      worker.postMessage({
        type: "find-duplicates",
        rows,
        settings,
      } satisfies DedupeWorkerRequest);
    });
  }, []);

  return {
    runDedupe,
    progress,
    isProcessing,
  };
}
