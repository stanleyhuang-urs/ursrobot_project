"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import type { BoardWithData, UserOption } from "@/types/board";
import type { UserRole } from "@prisma/client";
import { canManageStructure } from "@/lib/permissions";
import { computeOverdueUpcoming } from "@/lib/dashboard";
import {
  filterItemsByTeam,
  computeStatusBuckets,
  computeStatusBreakdown,
  computeTasksByOwner,
} from "@/lib/boardReport";
import { pieSlicePath } from "@/lib/pie";
import { ReportSettingsModal } from "./ReportSettingsModal";

const PIE_COLORS = ["#00c875", "#579bfc", "#fdab3d", "#e2445c", "#a25ddc", "#037f4c", "#ff642e", "#66ccff"];

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 text-center">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold" style={{ color: color ?? "#1f2937" }}>
        {value}
      </p>
    </div>
  );
}

export function BoardReport({
  board,
  users,
  userRole,
  currentUserId,
}: {
  board: BoardWithData;
  users: UserOption[];
  userRole: UserRole;
  currentUserId: string;
}) {
  const isSupervisor = userRole === "SUPERVISOR";
  const teamIds = isSupervisor
    ? [currentUserId, ...users.filter((u) => u.supervisorId === currentUserId).map((u) => u.id)]
    : null;
  const [scope, setScope] = useState<"team" | "all">(isSupervisor ? "team" : "all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const effectiveTeamIds = scope === "team" ? teamIds : null;

  const items = filterItemsByTeam(board, effectiveTeamIds);
  const buckets = computeStatusBuckets(board, items);
  const statusBreakdown = computeStatusBreakdown(board, items);
  const owners = computeTasksByOwner(board, items, users);
  const { overdue } = computeOverdueUpcoming([board], effectiveTeamIds ?? undefined);

  const statusTotal = statusBreakdown.reduce((sum, s) => sum + s.count, 0);
  const ownerTotal = owners.reduce((sum, o) => sum + o.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {isSupervisor ? (
          <div className="flex overflow-hidden rounded-md border border-neutral-200 text-xs">
            <button
              type="button"
              onClick={() => setScope("team")}
              className={`px-2.5 py-1 ${scope === "team" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}
            >
              我的團隊
            </button>
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`px-2.5 py-1 ${scope === "all" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}
            >
              全部
            </button>
          </div>
        ) : (
          <div />
        )}
        {canManageStructure(userRole) && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            <Settings size={13} /> 報表設定
          </button>
        )}
      </div>

      {!board.reportStatusColumnId && (
        <p className="text-sm text-neutral-400">
          尚未設定要統計的狀態欄位,請點右上角「報表設定」選擇。
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="全部任務" value={buckets.total} />
        <StatCard label="尚未處理" value={buckets.notStarted} color="#c4c4c4" />
        <StatCard label="計畫中" value={buckets.planned} color="#579bfc" />
        <StatCard label="進行中" value={buckets.inProgress} color="#fdab3d" />
        <StatCard label="暫停" value={buckets.paused} color="#a25ddc" />
        <StatCard label="卡住" value={buckets.stuck} color="#e2445c" />
        <StatCard label="已完成" value={buckets.done} color="#00c875" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-md border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-neutral-700">依狀態分布</h3>
          {statusBreakdown.length === 0 ? (
            <p className="text-sm text-neutral-400">尚無資料</p>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <svg viewBox="0 0 120 120" width={120} height={120} className="shrink-0">
                {(() => {
                  let cumulative = 0;
                  return statusBreakdown.map((s) => {
                    const fraction = statusTotal > 0 ? s.count / statusTotal : 0;
                    const startAngle = cumulative * 2 * Math.PI;
                    cumulative += fraction;
                    const endAngle = cumulative * 2 * Math.PI;
                    if (fraction >= 0.999) {
                      return <circle key={s.option.id} cx={60} cy={60} r={55} fill={s.option.color} />;
                    }
                    return (
                      <path key={s.option.id} d={pieSlicePath(60, 60, 55, startAngle, endAngle)} fill={s.option.color} />
                    );
                  });
                })()}
              </svg>
              <div className="min-w-[140px] flex-1 space-y-1">
                {statusBreakdown.map((s) => (
                  <div key={s.option.id} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.option.color }} />
                    <span className="min-w-0 flex-1 truncate text-neutral-700">{s.option.label}</span>
                    <span className="shrink-0 text-neutral-500">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-md border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-neutral-700">依負責人分布</h3>
          {owners.length === 0 ? (
            <p className="text-sm text-neutral-400">尚無資料</p>
          ) : (
            <div className="space-y-2">
              {owners.map((o, i) => (
                <div key={o.userId} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 truncate text-sm text-neutral-700">{o.userName}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${ownerTotal > 0 ? (o.count / ownerTotal) * 100 : 0}%`,
                        backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                      }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-sm text-neutral-500">{o.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">逾期任務({overdue.length})</h3>
        {overdue.length === 0 ? (
          <p className="text-sm text-neutral-400">沒有逾期項目</p>
        ) : (
          <ul className="space-y-1.5">
            {overdue.map((e) => (
              <li key={e.itemId} className="flex items-center justify-between text-sm">
                <Link href={`/boards/${e.boardId}?highlight=${e.itemId}`} className="truncate text-neutral-700 hover:text-blue-600">
                  {e.itemName}
                </Link>
                <span className="shrink-0 text-xs text-red-600">
                  {e.end.getUTCMonth() + 1}/{e.end.getUTCDate()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReportSettingsModal board={board} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
