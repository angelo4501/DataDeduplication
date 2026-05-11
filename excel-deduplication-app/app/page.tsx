import { DashboardOverview } from "@/components/dashboard/overview";
import { DashboardShell } from "@/components/shared/dashboard-shell";

export default function Home() {
  return (
    <DashboardShell>
      <DashboardOverview />
    </DashboardShell>
  );
}
