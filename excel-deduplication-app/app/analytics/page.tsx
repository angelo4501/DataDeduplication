import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { DashboardShell } from "@/components/shared/dashboard-shell";

export default function AnalyticsPage() {
  return (
    <DashboardShell>
      <AnalyticsDashboard />
    </DashboardShell>
  );
}
