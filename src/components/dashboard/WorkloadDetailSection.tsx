"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, ChevronDown, ChevronRight } from "lucide-react";
import { colorForPct, type WorkloadThresholdSettings, type MemberTask } from "@/lib/workload";
import { WorkloadThresholdModal } from "./WorkloadThresholdModal";

const DAY_WIDTH = 10;

function formatDate(date: Date) {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

export function WorkloadDetailSection({
  users,
  tasksByUser,
  timelineDays,
  timelineLabel,
  timelineByUser,
  monthly,
  threshold,
  canManageThreshold,
}: {
  users: { id: string; name: string }[];
  tasksByUser: Record<string, MemberTask[]>;
  timelineDays: string[];
  timelineLabel: string;
  timelineByUser: Record<string, Record<string, number>>;
  monthly: { userId: string; months: { label: string; avgPct: number }[] }[];
  threshold: WorkloadThresholdSettings;
  canManageThreshold: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const monthlyByUser = new Map(monthly.map((m) => [m.userId, m.months]));

  function toggle(userId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">成員工作量明細</h2>
        {canManageThreshold && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            <Settings size={13} /> 顏色門檻設定
          </button>
        )}
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-neutral-400">目前沒有成員資料。</p>
      ) : (
        <div className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
          {users.map((user) => {
            const tasks = tasksByUser[user.id] ?? [];
            const dayLoad = timelineByUser[user.id] ?? {};
            const months = monthlyByUser.get(user.id) ?? [];
            const isOpen = expanded.has(user.id);

            return (
              <div key={user.id} className="p-3">
                <button
                  type="button"
                  onClick={() => toggle(user.id)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="w-20 shrink-0 truncate text-sm font-medium text-neutral-800">
                    {user.name}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {tasks.length} 項任務
                  </span>

                  <div className="flex shrink-0 gap-px overflow-hidden rounded" title={timelineLabel}>
                    {timelineDays.map((date) => (
                      <div
                        key={date}
                        style={{
                          width: DAY_WIDTH,
                          height: 14,
                          backgroundColor: colorForPct(dayLoad[date] ?? 0, threshold),
                          opacity: (dayLoad[date] ?? 0) > 0 ? 1 : 0.25,
                        }}
                        title={`${date}: ${dayLoad[date] ?? 0}%`}
                      />
                    ))}
                  </div>

                  <div className="ml-auto flex shrink-0 gap-1">
                    {months.map((m) => (
                      <span
                        key={m.label}
                        title={`${m.label}: ${m.avgPct}%`}
                        className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                        style={{ backgroundColor: colorForPct(m.avgPct, threshold) }}
                      >
                        {m.label} {m.avgPct}%
                      </span>
                    ))}
                  </div>
                </button>

                {isOpen && (
                  <ul className="mt-2 space-y-1 pl-6">
                    {tasks.length === 0 ? (
                      <li className="text-xs text-neutral-400">目前沒有指派中的任務</li>
                    ) : (
                      tasks.map((t) => (
                        <li
                          key={`${t.boardId}-${t.itemId}`}
                          className="flex items-center gap-2 text-xs text-neutral-600"
                        >
                          <Link
                            href={`/boards/${t.boardId}`}
                            className="min-w-0 flex-1 truncate hover:text-blue-600"
                          >
                            {t.itemName}
                          </Link>
                          <span className="shrink-0 text-neutral-400">{t.boardName}</span>
                          {t.startDate && t.endDate && (
                            <span className="shrink-0 text-neutral-400">
                              {formatDate(t.startDate)} ~ {formatDate(t.endDate)}
                            </span>
                          )}
                          <span className="shrink-0 font-medium text-neutral-700">
                            {t.allocationPct}%
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <WorkloadThresholdModal
        threshold={threshold}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </section>
  );
}
