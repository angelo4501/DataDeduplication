"use client";

import { BarChart3, Clock, Database, Percent, ShieldCheck } from "lucide-react";

import { MetricCard } from "@/components/shared/metric-card";
import { VirtualTable } from "@/components/shared/virtual-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDedupeStore } from "@/store/use-dedupe-store";
import type { ParsedRow } from "@/types";

export function DashboardOverview() {
  const { analytics, duplicateGroups, cleanedRows, rows } = useDedupeStore();
  const previewColumns = Object.keys(cleanedRows[0]?.values ?? {})
    .slice(0, 8)
    .map((key) => ({
      key,
      header: key,
      render: (row: ParsedRow) => String(row.values[key] ?? ""),
    }));

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title="Total records"
          value={(analytics?.totalRecords ?? rows.length).toLocaleString()}
          description="Selected rows ready for processing"
          icon={Database}
        />
        <MetricCard
          title="Duplicate records"
          value={(analytics?.duplicateRecords ?? 0).toLocaleString()}
          description="Rows included in duplicate clusters"
          icon={ShieldCheck}
        />
        <MetricCard
          title="Duplicate rate"
          value={`${analytics?.duplicatePercentage ?? 0}%`}
          description="Share of uploaded dataset"
          icon={Percent}
        />
        <MetricCard
          title="Processing time"
          value={`${analytics?.processingTimeMs ?? 0}ms`}
          description="Worker-side matching runtime"
          icon={Clock}
        />
        <MetricCard
          title="Duplicate groups"
          value={(analytics?.duplicateGroups ?? duplicateGroups.length).toLocaleString()}
          description="Clustered candidate groups"
          icon={BarChart3}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Cleaned dataset preview</CardTitle>
            <CardDescription>Virtualized preview of records after approved merges.</CardDescription>
          </CardHeader>
          <CardContent>
            {cleanedRows.length > 0 && previewColumns.length > 0 ? (
              <VirtualTable rows={cleanedRows} columns={previewColumns} />
            ) : (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Upload data to preview cleaned records.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Highest confidence groups</CardTitle>
            <CardDescription>Review the strongest matches first to reduce risk.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {duplicateGroups.slice(0, 8).map((group) => (
              <div key={group.id} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{group.records.length} records</p>
                    <p className="text-sm text-muted-foreground">{group.classification.replace("_", " ")}</p>
                  </div>
                  <Badge>{group.confidence}%</Badge>
                </div>
              </div>
            ))}
            {duplicateGroups.length === 0 && (
              <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No duplicate groups yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
