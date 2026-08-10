import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { boardWithDataArgs } from "@/types/board";
import {
  computeTeamWorkload,
  computeBoardProgressOverview,
  computeOverdueUpcoming,
  computePersonalItems,
} from "@/lib/dashboard";
import { TeamWorkloadCard } from "@/components/dashboard/TeamWorkloadCard";

function formatDate(date: Date) {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

export default async function DashboardPage() {
  const session = await requireSession();

  const [boards, users] = await Promise.all([
    prisma.board.findMany({ ...boardWithDataArgs, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({
      select: { id: true, name: true, supervisorId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u.name]));
  const isSupervisor = session.role === "SUPERVISOR";
  const teamMembers = isSupervisor
    ? users.filter((u) => u.supervisorId === session.userId)
    : [];
  const workloadScope = isSupervisor ? teamMembers : users;

  const teamWorkloadDay = computeTeamWorkload(boards, workloadScope, "day");
  const teamWorkloadWeek = computeTeamWorkload(boards, workloadScope, "week");
  const teamWorkloadMonth = computeTeamWorkload(boards, workloadScope, "month");
  const boardProgress = computeBoardProgressOverview(boards);
  const { overdue, upcoming } = computeOverdueUpcoming(boards);
  const personalItems = computePersonalItems(boards, [session.userId], userById);
  const teamItems = isSupervisor
    ? computePersonalItems(boards, teamMembers.map((m) => m.id), userById)
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <h1 className="text-lg font-semibold text-neutral-900">儀表板</h1>

      <TeamWorkloadCard
        title={isSupervisor ? "我的團隊工作量總覽" : "團隊工作量總覽"}
        day={teamWorkloadDay}
        week={teamWorkloadWeek}
        month={teamWorkloadMonth}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">看板進度總覽</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {boardProgress.map((b) => (
            <Link
              key={b.boardId}
              href={`/boards/${b.boardId}`}
              className="rounded-md border border-neutral-200 bg-white p-4 hover:border-blue-300"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-900">{b.boardName}</span>
                <span className="text-xs text-neutral-400">{b.itemCount} 項目</span>
              </div>
              {b.avgProgress !== null && (
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.round(b.avgProgress * 100)}%` }}
                  />
                </div>
              )}
              {b.statusBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {b.statusBreakdown
                    .filter((s) => s.count > 0)
                    .map((s) => (
                      <span
                        key={s.option.id}
                        className="rounded-full px-2 py-0.5 text-xs text-white"
                        style={{ backgroundColor: s.option.color }}
                      >
                        {s.option.label} {s.count}
                      </span>
                    ))}
                </div>
              )}
            </Link>
          ))}
          {boardProgress.length === 0 && (
            <p className="text-sm text-neutral-400">尚無看板</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">逾期 / 即將到期項目</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-neutral-200 bg-white p-4">
            <p className="mb-2 text-xs font-medium text-red-600">逾期({overdue.length})</p>
            {overdue.length === 0 ? (
              <p className="text-sm text-neutral-400">沒有逾期項目</p>
            ) : (
              <ul className="space-y-1.5">
                {overdue.map((e) => (
                  <li key={`${e.boardId}-${e.itemId}`} className="flex items-center justify-between text-sm">
                    <Link href={`/boards/${e.boardId}`} className="truncate text-neutral-700 hover:text-blue-600">
                      {e.itemName}
                    </Link>
                    <span className="shrink-0 text-xs text-red-600">{formatDate(e.end)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-md border border-neutral-200 bg-white p-4">
            <p className="mb-2 text-xs font-medium text-neutral-500">即將到期,7 天內({upcoming.length})</p>
            {upcoming.length === 0 ? (
              <p className="text-sm text-neutral-400">7 天內沒有到期項目</p>
            ) : (
              <ul className="space-y-1.5">
                {upcoming.map((e) => (
                  <li key={`${e.boardId}-${e.itemId}`} className="flex items-center justify-between text-sm">
                    <Link href={`/boards/${e.boardId}`} className="truncate text-neutral-700 hover:text-blue-600">
                      {e.itemName}
                    </Link>
                    <span className="shrink-0 text-xs text-neutral-500">{formatDate(e.end)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {isSupervisor && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">
            團隊項目({teamItems.length})
          </h2>
          <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            {teamItems.length === 0 ? (
              <p className="p-4 text-sm text-neutral-400">你的團隊目前沒有指派中的項目</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {teamItems.map((item) => (
                  <li key={`${item.boardId}-${item.itemId}`} className="flex items-center gap-3 px-4 py-2.5">
                    <Link
                      href={`/boards/${item.boardId}`}
                      className="min-w-0 flex-1 truncate text-sm text-neutral-800 hover:text-blue-600"
                    >
                      {item.itemName}
                    </Link>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {item.assigneeNames.join(", ")}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-400">{item.boardName}</span>
                    {item.status && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-xs text-white"
                        style={{ backgroundColor: item.status.color }}
                      >
                        {item.status.label}
                      </span>
                    )}
                    {item.dueDate && (
                      <span className="shrink-0 text-xs text-neutral-500">{formatDate(item.dueDate)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">
          我的項目({personalItems.length})
        </h2>
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          {personalItems.length === 0 ? (
            <p className="p-4 text-sm text-neutral-400">目前沒有指派給你的項目</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {personalItems.map((item) => (
                <li key={`${item.boardId}-${item.itemId}`} className="flex items-center gap-3 px-4 py-2.5">
                  <Link
                    href={`/boards/${item.boardId}`}
                    className="min-w-0 flex-1 truncate text-sm text-neutral-800 hover:text-blue-600"
                  >
                    {item.itemName}
                  </Link>
                  <span className="shrink-0 text-xs text-neutral-400">{item.boardName}</span>
                  {item.status && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs text-white"
                      style={{ backgroundColor: item.status.color }}
                    >
                      {item.status.label}
                    </span>
                  )}
                  {item.dueDate && (
                    <span className="shrink-0 text-xs text-neutral-500">{formatDate(item.dueDate)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
