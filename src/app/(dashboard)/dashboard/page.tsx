import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { boardWithDataArgs } from "@/types/board";
import { accessibleBoardWhere } from "@/lib/boardAccess";
import { canManageStructure } from "@/lib/permissions";
import {
  computeTeamWorkload,
  computeMemberItemWorkload,
  computeBoardProgressOverview,
  computeOverdueUpcoming,
  computePersonalItems,
  type PersonalItemEntry,
  type WorkloadPeriod,
  type MemberItemWorkloadEntry,
} from "@/lib/dashboard";
import { TeamWorkloadCard } from "@/components/dashboard/TeamWorkloadCard";
import { WorkloadDetailSection } from "@/components/dashboard/WorkloadDetailSection";
import { getWorkloadThreshold } from "@/lib/actions/workloadThreshold";
import {
  computeMemberTaskBreakdown,
  computeWeekColumns,
  computeMemberWeeklyLoad,
  type MemberTask,
} from "@/lib/workload";

function formatDate(date: Date) {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function AssignedItemRow({ item, showAssignees }: { item: PersonalItemEntry; showAssignees: boolean }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Link
        href={`/boards/${item.boardId}`}
        className="min-w-0 flex-1 truncate text-sm text-neutral-800 hover:text-blue-600"
      >
        {item.itemName}
      </Link>
      {showAssignees && (
        <span className="shrink-0 text-xs text-neutral-500">
          {item.assignees
            .map((a) => (a.allocationPct !== null ? `${a.name} ${a.allocationPct}%` : a.name))
            .join(", ")}
        </span>
      )}
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
        <span className="shrink-0 text-xs text-neutral-500">
          {item.startDate && `${formatDate(item.startDate)} ~ `}
          {formatDate(item.dueDate)}
        </span>
      )}
    </li>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const session = await requireSession();
  const { board: boardFilter } = await searchParams;

  const [allBoards, users] = await Promise.all([
    prisma.board.findMany({
      where: accessibleBoardWhere(session),
      ...boardWithDataArgs,
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, supervisorId: true, avatarUrl: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const boards = boardFilter ? allBoards.filter((b) => b.id === boardFilter) : allBoards;

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
  const { overdue, upcoming } = computeOverdueUpcoming(
    boards,
    isSupervisor ? teamMembers.map((m) => m.id) : undefined
  );
  const personalItems = computePersonalItems(boards, [session.userId], userById);
  const teamItems = isSupervisor
    ? computePersonalItems(boards, teamMembers.map((m) => m.id), userById)
    : [];

  const workloadThreshold = await getWorkloadThreshold();
  const workloadScopeIds = workloadScope.map((u) => u.id);
  const memberTasksMap = computeMemberTaskBreakdown(boards, workloadScopeIds);
  const myOwnTasks = computeMemberTaskBreakdown(boards, [session.userId]).get(session.userId) ?? [];
  // Admins aren't limited to delegating their own work — they can split a
  // subtask off any task. Supervisors stay scoped to tasks assigned to them.
  const parentTaskOptions =
    session.role === "ADMIN"
      ? allBoards.flatMap((b) =>
          b.items.map((i) => ({
            boardId: b.id,
            boardName: b.name,
            itemId: i.id,
            itemName: i.name,
          }))
        )
      : myOwnTasks;
  const weekColumns = computeWeekColumns(boards);
  const weeklyLoadMap = computeMemberWeeklyLoad(boards, workloadScopeIds, weekColumns);

  const tasksByUser: Record<string, MemberTask[]> = {};
  const weeklyLoadByUser: Record<string, number[]> = {};
  for (const id of workloadScopeIds) {
    tasksByUser[id] = memberTasksMap.get(id) ?? [];
    weeklyLoadByUser[id] = weeklyLoadMap.get(id) ?? [];
  }

  const memberItemWorkload: Record<string, Record<WorkloadPeriod, MemberItemWorkloadEntry[]>> = {};
  for (const id of workloadScopeIds) {
    memberItemWorkload[id] = {
      day: computeMemberItemWorkload(boards, id, "day"),
      week: computeMemberItemWorkload(boards, id, "week"),
      month: computeMemberItemWorkload(boards, id, "month"),
    };
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">儀表板</h1>
        <form action="/dashboard" method="GET" className="flex items-center gap-2 text-sm">
          <span className="text-neutral-500">看板篩選</span>
          <select
            name="board"
            defaultValue={boardFilter ?? ""}
            className="rounded-md border border-neutral-300 px-2 py-1.5 outline-none focus:border-blue-500"
          >
            <option value="">全部看板</option>
            {allBoards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-neutral-600 hover:bg-neutral-50"
          >
            套用
          </button>
        </form>
      </div>

      <TeamWorkloadCard
        title={isSupervisor ? "我的團隊工作量總覽" : "團隊工作量總覽"}
        day={teamWorkloadDay}
        week={teamWorkloadWeek}
        month={teamWorkloadMonth}
        tasksByUser={tasksByUser}
        memberItemWorkload={memberItemWorkload}
      />

      <WorkloadDetailSection
        users={workloadScope.map((u) => ({ id: u.id, name: u.name }))}
        tasksByUser={tasksByUser}
        weeks={weekColumns}
        weeklyLoadByUser={weeklyLoadByUser}
        threshold={workloadThreshold}
        canManageThreshold={session.role === "ADMIN"}
        canCreateSubtask={canManageStructure(session.role)}
        parentTaskOptions={parentTaskOptions}
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
                  <AssignedItemRow key={`${item.boardId}-${item.itemId}`} item={item} showAssignees />
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
                <AssignedItemRow key={`${item.boardId}-${item.itemId}`} item={item} showAssignees={false} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
