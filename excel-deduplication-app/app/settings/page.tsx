import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { DashboardShell } from "@/components/shared/dashboard-shell";

export default function SettingsPage() {
  return (
    <DashboardShell>
      <SettingsPanel />
    </DashboardShell>
  );
}
