import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getSystemSettings } from "@/lib/actions/systemSettings";
import { listHolidays } from "@/lib/holidays";
import { SystemSettingsForm } from "@/components/settings/SystemSettingsForm";

export default async function SettingsPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    redirect("/boards");
  }

  const [settings, holidays] = await Promise.all([getSystemSettings(), listHolidays()]);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-lg font-semibold text-neutral-900">系統設定</h1>
      <SystemSettingsForm
        emailNotificationsEnabled={settings.emailNotificationsEnabled}
        ganttDurationMode={settings.ganttDurationMode}
        levelColors={settings.levelColors}
        holidays={holidays}
      />
    </div>
  );
}
