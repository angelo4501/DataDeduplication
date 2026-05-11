import { FileUpload } from "@/components/upload/file-upload";
import { DashboardShell } from "@/components/shared/dashboard-shell";

export default function UploadPage() {
  return (
    <DashboardShell>
      <FileUpload />
    </DashboardShell>
  );
}
