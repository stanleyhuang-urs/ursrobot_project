import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getSystemSettings } from "@/lib/actions/systemSettings";
import { listHolidays } from "@/lib/holidays";
import { SystemSettingsForm } from "@/components/settings/SystemSettingsForm";

export default async function SettingsPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    redirect("/boards");
  }

  const [settings, holidays, boards] = await Promise.all([
    getSystemSettings(),
    listHolidays(),
    prisma.board.findMany({
      select: {
        id: true,
        name: true,
        columns: true,
        ganttStartColumnId: true,
        ganttDurationColumnId: true,
        ganttEndColumnId: true,
        predColumnId: true,
        linkColumnId: true,
        lagColumnId: true,
        typeColumnId: true,
        manualStartColumnId: true,
        manualDurationColumnId: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-lg font-semibold text-neutral-900">系統設定</h1>
      <SystemSettingsForm
        emailNotificationsEnabled={settings.emailNotificationsEnabled}
        ganttDurationMode={settings.ganttDurationMode}
        levelColors={settings.levelColors}
        holidays={holidays}
        ganttMappingBoards={boards}
      />
    </div>
  );
}
