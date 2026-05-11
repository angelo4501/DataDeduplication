"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDedupeStore } from "@/store/use-dedupe-store";

const COLORS = ["#18181b", "#71717a", "#a1a1aa", "#d4d4d8"];

export function AnalyticsDashboard() {
  const { analytics, duplicateGroups } = useDedupeStore();
  const distribution = [
    { name: "Exact", value: analytics?.exactGroups ?? 0 },
    { name: "Highly probable", value: analytics?.highProbabilityGroups ?? 0 },
    { name: "Possible", value: analytics?.possibleGroups ?? 0 },
  ];
  const confidenceBands = [
    { name: "95-100", groups: duplicateGroups.filter((group) => group.confidence >= 95).length },
    { name: "85-94", groups: duplicateGroups.filter((group) => group.confidence >= 85 && group.confidence < 95).length },
    { name: "70-84", groups: duplicateGroups.filter((group) => group.confidence >= 70 && group.confidence < 85).length },
  ];
  const trend = duplicateGroups.slice(0, 20).map((group, index) => ({
    name: `G${index + 1}`,
    confidence: group.confidence,
  }));

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Confidence distribution</CardTitle>
            <CardDescription>Duplicate groups by threshold band.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribution} dataKey="value" nameKey="name" outerRadius={110} label>
                  {distribution.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Threshold bands</CardTitle>
            <CardDescription>Exact, high-probability, and possible duplicate clusters.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confidenceBands}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="groups" fill="#18181b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top confidence trend</CardTitle>
          <CardDescription>First 20 sorted groups from the matching output.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="confidence" fill="#52525b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
