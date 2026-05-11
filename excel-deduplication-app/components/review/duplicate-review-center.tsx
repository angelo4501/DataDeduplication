"use client";

import { useMemo, useState } from "react";
import { Check, Download, EyeOff, GitMerge, ShieldAlert } from "lucide-react";

import { buildAuditTrailCsv, buildCleanCsv, buildDuplicateReportCsv, downloadBlob, downloadWorkbook } from "@/services/export";
import { mergeRecords } from "@/services/dedupe-engine/merge";
import { useDedupeStore } from "@/store/use-dedupe-store";
import type { DuplicateClassification, DuplicateGroup } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function confidenceVariant(classification: DuplicateClassification) {
  if (classification === "exact") {
    return "default";
  }
  if (classification === "highly_probable") {
    return "secondary";
  }
  return "outline";
}

function groupLabel(group: DuplicateGroup): string {
  const firstRecord = group.records[0];
  const values = Object.values(firstRecord?.values ?? {}).filter(Boolean).slice(0, 2);
  return values.join(" ") || group.id;
}

export function DuplicateReviewCenter() {
  const {
    duplicateGroups,
    cleanedRows,
    auditTrail,
    mergeGroup,
    ignoreGroup,
    markUnique,
    approveAll,
  } = useDedupeStore();
  const pendingGroups = duplicateGroups.filter((group) => group.status === "pending");
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(pendingGroups[0]?.id);
  const [previewOpen, setPreviewOpen] = useState(false);
  const selectedGroup =
    duplicateGroups.find((group) => group.id === selectedGroupId) ?? pendingGroups[0] ?? duplicateGroups[0];
  const mergePreview = selectedGroup ? mergeRecords(selectedGroup).record : undefined;

  const comparisonKeys = useMemo(() => {
    if (!selectedGroup) {
      return [];
    }
    return [...new Set(selectedGroup.records.flatMap((record) => Object.keys(record.values)))];
  }, [selectedGroup]);

  function handleExportXlsx() {
    downloadWorkbook({
      cleanedRows,
      duplicateGroups,
      auditTrail,
      generatedAt: new Date().toISOString(),
    });
  }

  function handleExportCsv(type: "clean" | "duplicates" | "audit") {
    const payload = {
      cleanedRows,
      duplicateGroups,
      auditTrail,
      generatedAt: new Date().toISOString(),
    };
    const csv =
      type === "clean"
        ? buildCleanCsv(cleanedRows)
        : type === "duplicates"
          ? buildDuplicateReportCsv(duplicateGroups)
          : buildAuditTrailCsv(payload);

    downloadBlob(csv, `${type}-export.csv`, "text/csv;charset=utf-8");
  }

  if (duplicateGroups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No duplicate groups yet</CardTitle>
          <CardDescription>Upload files and run detection to review duplicate clusters.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Duplicate queue</CardTitle>
          <CardDescription>
            {pendingGroups.length.toLocaleString()} pending of {duplicateGroups.length.toLocaleString()} groups.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={approveAll} disabled={pendingGroups.length === 0}>
              <Check className="mr-2 size-4" />
              Approve all
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="mr-2 size-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportXlsx}>Cleaned workbook</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCsv("clean")}>Clean CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCsv("duplicates")}>Duplicate report</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCsv("audit")}>Audit trail</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="max-h-[640px] space-y-2 overflow-auto pr-1">
            {duplicateGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedGroupId(group.id)}
                className="w-full rounded-2xl border bg-background p-4 text-left transition hover:bg-muted/60 data-[selected=true]:border-primary"
                data-selected={group.id === selectedGroup?.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{groupLabel(group)}</p>
                    <p className="text-sm text-muted-foreground">
                      {group.records.length} records • {group.status}
                    </p>
                  </div>
                  <Badge variant={confidenceVariant(group.classification)}>
                    {group.confidence}%
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedGroup && (
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="size-5" />
                Review group {selectedGroup.confidence}%
              </CardTitle>
              <CardDescription>
                {selectedGroup.classification.replace("_", " ")} duplicate with field-level scoring reasons.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setPreviewOpen(true)} variant="outline">
                Preview merge
              </Button>
              <Button onClick={() => mergeGroup(selectedGroup.id)}>
                <GitMerge className="mr-2 size-4" />
                Merge
              </Button>
              <Button variant="secondary" onClick={() => ignoreGroup(selectedGroup.id)}>
                <EyeOff className="mr-2 size-4" />
                Ignore
              </Button>
              <Button variant="ghost" onClick={() => markUnique(selectedGroup.id)}>
                Mark unique
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="comparison">
              <TabsList>
                <TabsTrigger value="comparison">Comparison</TabsTrigger>
                <TabsTrigger value="reasons">Reasons</TabsTrigger>
              </TabsList>
              <TabsContent value="comparison" className="mt-4">
                <div className="overflow-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background">Field</TableHead>
                        {selectedGroup.records.map((record) => (
                          <TableHead key={record.id}>Row {record.rowNumber}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonKeys.map((key) => {
                        const values = selectedGroup.records.map((record) => String(record.values[key] ?? ""));
                        const differs = new Set(values.map((value) => value.toLowerCase().trim())).size > 1;

                        return (
                          <TableRow key={key} className={differs ? "bg-amber-500/5" : undefined}>
                            <TableCell className="sticky left-0 bg-background font-medium">{key}</TableCell>
                            {selectedGroup.records.map((record) => (
                              <TableCell key={record.id} className={differs ? "font-medium" : undefined}>
                                {String(record.values[key] ?? "") || <span className="text-muted-foreground">Empty</span>}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              <TabsContent value="reasons" className="mt-4">
                <div className="grid gap-3">
                  {selectedGroup.reasons.map((reason) => (
                    <div key={reason.field} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{reason.label}</p>
                        <Badge variant="outline">{reason.score}%</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {reason.strategy} • weight {Math.round(reason.weight * 100)}%
                      </p>
                      <p className="mt-2 text-sm">
                        <span className="text-muted-foreground">A:</span> {reason.left || "Empty"}{" "}
                        <span className="text-muted-foreground">B:</span> {reason.right || "Empty"}
                      </p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Merge preview</DialogTitle>
            <DialogDescription>
              The engine prefers valid phones, non-empty fields, longest addresses, and latest updated values.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[520px] overflow-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Selected value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(mergePreview?.values ?? {}).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{key}</TableCell>
                    <TableCell>{String(value ?? "")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
