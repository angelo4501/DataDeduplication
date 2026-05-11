import { DuplicateReviewCenter } from "@/components/review/duplicate-review-center";
import { DashboardShell } from "@/components/shared/dashboard-shell";

export default function ReviewPage() {
  return (
    <DashboardShell>
      <DuplicateReviewCenter />
    </DashboardShell>
  );
}
