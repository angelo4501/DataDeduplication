"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { useDedupeWorker } from "@/hooks/use-dedupe-worker";
import { parseFile } from "@/services/parser/excel-parser";
import { useDedupeStore } from "@/store/use-dedupe-store";
import { validateUploadFile } from "@/utils/security";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FileUpload() {
  const [isParsing, setIsParsing] = useState(false);
  const {
    files,
    rows,
    settings,
    addFiles,
    removeFile,
    selectSheet,
    setDedupeResult,
    setProgress,
  } = useDedupeStore();
  const { runDedupe, progress, isProcessing } = useDedupeWorker();

  useEffect(() => {
    setProgress(progress);
  }, [progress, setProgress]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setIsParsing(true);
      const parsedFiles = [];

      for (const file of acceptedFiles) {
        const validation = validateUploadFile(file);
        if (!validation.valid) {
          toast.error(`${file.name}: ${validation.errors.join(" ")}`);
          continue;
        }

        try {
          const parsed = await parseFile(file);
          parsedFiles.push(parsed);
          toast.success(`Parsed ${file.name}`);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : `Unable to parse ${file.name}`);
        }
      }

      if (parsedFiles.length > 0) {
        addFiles(parsedFiles);
      }
      setIsParsing(false);
    },
    [addFiles],
  );

  const dropzone = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 75 * 1024 * 1024,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
  });

  const progressPercent = useMemo(() => {
    if (!progress.total) {
      return isProcessing || isParsing ? 8 : 0;
    }
    return Math.min(100, Math.round((progress.processed / progress.total) * 100));
  }, [isParsing, isProcessing, progress.processed, progress.total]);

  async function handleFindDuplicates() {
    if (rows.length < 2) {
      toast.error("Upload at least two rows before running duplicate detection.");
      return;
    }

    try {
      const result = await runDedupe(rows, settings);
      setDedupeResult(result);
      toast.success(`Found ${result.groups.length} duplicate groups`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Duplicate detection failed");
    }
  }

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Upload Excel or CSV files</CardTitle>
          <CardDescription>
            Files are parsed in the browser. Supported formats: .xlsx, .xls, and .csv up to 75 MB each.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...dropzone.getRootProps()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed bg-muted/40 px-6 py-14 text-center transition hover:bg-muted"
          >
            <input {...dropzone.getInputProps()} />
            <UploadCloud className="size-12 text-muted-foreground" />
            <h3 className="mt-4 text-xl font-semibold">Drop files here or click to browse</h3>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Upload multiple exports from CRMs, voter systems, HR tools, or customer databases. The parser
              auto-detects headers and worksheets.
            </p>
          </div>

          {(isParsing || isProcessing) && (
            <div className="mt-6 rounded-2xl border bg-background p-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Loader2 className="size-4 animate-spin" />
                  {isParsing ? "Parsing files" : progress.message}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Recent uploads</CardTitle>
            <CardDescription>Select worksheets and verify row counts before processing.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {files.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No uploads yet.
              </div>
            ) : (
              files.map((file) => (
                <div key={file.id} className="rounded-2xl border p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <div className="rounded-xl bg-primary/10 p-2 text-primary">
                        <FileSpreadsheet className="size-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold">{file.name}</h4>
                          {file.errors.length > 0 ? (
                            <Badge variant="destructive">Invalid</Badge>
                          ) : (
                            <Badge variant="secondary">Ready</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB • {file.sheets.length} worksheet(s)
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeFile(file.id)}>
                      Remove
                    </Button>
                  </div>

                  {file.errors.length > 0 ? (
                    <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="size-4" />
                      {file.errors.join(" ")}
                    </p>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-[240px_1fr]">
                      <Select
                        value={file.selectedSheetId ?? file.sheets[0]?.id}
                        onValueChange={(sheetId) => {
                          if (sheetId) {
                            selectSheet(file.id, sheetId);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select worksheet" />
                        </SelectTrigger>
                        <SelectContent>
                          {file.sheets.map((sheet) => (
                            <SelectItem key={sheet.id} value={sheet.id}>
                              {sheet.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                        {file.sheets.map((sheet) => (
                          <div key={sheet.id} className="rounded-xl bg-muted/60 p-3">
                            <p className="font-medium text-foreground">{sheet.name}</p>
                            <p>{sheet.rowCount.toLocaleString()} rows</p>
                            <p>{sheet.malformedRows.toLocaleString()} malformed</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing summary</CardTitle>
            <CardDescription>Run weighted fuzzy matching once sheets are selected.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-2xl bg-muted/60 p-4">
              <p className="text-sm text-muted-foreground">Selected rows</p>
              <p className="text-3xl font-semibold">{rows.length.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl bg-muted/60 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-4 text-emerald-500" />
                Enterprise matching rules
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Last name, first name, birthdate, middle name, and address are scored with configurable
                thresholds.
              </p>
            </div>
            <Button disabled={isParsing || isProcessing || rows.length < 2} onClick={handleFindDuplicates}>
              {isProcessing && <Loader2 className="mr-2 size-4 animate-spin" />}
              Find duplicates
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
