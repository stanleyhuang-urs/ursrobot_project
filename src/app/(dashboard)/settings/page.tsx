import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getSystemSettings } from "@/lib/actions/systemSettings";
import { listHolidays } from "@/lib/holidays";
import { getWorkloadThreshold } from "@/lib/actions/workloadThreshold";
import { SystemSettingsForm } from "@/components/settings/SystemSettingsForm";

export default async function SettingsPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    redirect("/boards");
  }

  const [settings, holidays, workloadThreshold, boards] = await Promise.all([
    getSystemSettings(),
    listHolidays(),
    getWorkloadThreshold(),
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
        reportStatusColumnId: true,
        reportNotStartedOptionIds: true,
        reportPlannedOptionIds: true,
        reportPausedOptionIds: true,
        reportStuckOptionIds: true,
        reportDoneOptionIds: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">系統設定</h1>
      <SystemSettingsForm
        emailNotificationsEnabled={settings.emailNotificationsEnabled}
        ganttDurationMode={settings.ganttDurationMode}
        levelColors={settings.levelColors}
        ganttStatusColors={{
          overdue: settings.ganttOverdueColor,
          completed: settings.ganttCompletedColor,
          inProgress: settings.ganttInProgressColor,
        }}
        holidays={holidays}
        workloadThreshold={workloadThreshold}
        ganttMappingBoards={boards}
        reportSettingsBoards={boards}
      />
    </div>
  );
}
