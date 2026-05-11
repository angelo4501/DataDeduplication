"use client";

import { useMemo, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function VirtualTable<T>({
  rows,
  columns,
  rowHeight = 44,
  height = 420,
}: {
  rows: T[];
  columns: Array<{ key: string; header: string; render: (row: T) => React.ReactNode }>;
  rowHeight?: number;
  height?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const visibleCount = Math.ceil(height / rowHeight) + 8;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 4);
  const visibleRows = useMemo(() => rows.slice(start, start + visibleCount), [rows, start, visibleCount]);
  const totalHeight = rows.length * rowHeight;

  return (
    <div
      className="relative overflow-auto rounded-xl border"
      style={{ height }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight || rowHeight }}>
        <Table className="absolute inset-x-0 top-0" style={{ transform: `translateY(${start * rowHeight}px)` }}>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row, index) => (
              <TableRow key={`${start}-${index}`} style={{ height: rowHeight }}>
                {columns.map((column) => (
                  <TableCell key={column.key}>{column.render(row)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
