"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, ChevronDown, ChevronRight } from "lucide-react";
import {
  colorForPct,
  weekIndexForDate,
  type WorkloadThresholdSettings,
  type MemberTask,
  type WeekColumn,
} from "@/lib/workload";
import { WorkloadThresholdModal } from "./WorkloadThresholdModal";

const LABEL_WIDTH = 140;
const WEEK_WIDTH = 26;

export function WorkloadDetailSection({
  users,
  tasksByUser,
  weeks,
  weeklyLoadByUser,
  threshold,
  canManageThreshold,
}: {
  users: { id: string; name: string }[];
  tasksByUser: Record<string, MemberTask[]>;
  weeks: WeekColumn[];
  weeklyLoadByUser: Record<string, number[]>;
  threshold: WorkloadThresholdSettings;
  canManageThreshold: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const timelineWidth = weeks.length * WEEK_WIDTH;

  const monthGroups: { label: string; count: number }[] = [];
  for (const week of weeks) {
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.label === week.monthLabel) last.count += 1;
    else monthGroups.push({ label: week.monthLabel, count: 1 });
  }

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
        <div className="overflow-x-auto">
          <div style={{ width: LABEL_WIDTH + timelineWidth }}>
            <div className="mb-2 overflow-hidden rounded-md border border-neutral-200">
              <div className="flex border-b border-neutral-100 bg-neutral-50 text-[10px] font-medium text-neutral-500">
                <div style={{ width: LABEL_WIDTH }} className="shrink-0 border-r border-neutral-100 px-2 py-1">
                  成員
                </div>
                <div className="flex">
                  {monthGroups.map((g, i) => (
                    <div
                      key={`${g.label}-${i}`}
                      style={{ width: g.count * WEEK_WIDTH }}
                      className="shrink-0 truncate border-r border-neutral-100 px-1 py-1"
                    >
                      {g.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex bg-neutral-50 text-[9px] text-neutral-400">
                <div style={{ width: LABEL_WIDTH }} className="shrink-0 border-r border-neutral-100" />
                <div className="flex">
                  {weeks.map((w, i) => (
                    <div
                      key={i}
                      style={{ width: WEEK_WIDTH }}
                      className={`shrink-0 truncate text-center ${w.isMonthStart ? "border-l border-neutral-300" : ""}`}
                    >
                      {w.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {users.map((user) => {
                const tasks = tasksByUser[user.id] ?? [];
                const weekly = weeklyLoadByUser[user.id] ?? [];
                const isOpen = expanded.has(user.id);

                return (
                  <div
                    key={user.id}
                    className="overflow-hidden rounded-md border border-neutral-200 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(user.id)}
                      className="flex w-full items-center text-left hover:bg-neutral-50"
                    >
                      <div
                        style={{ width: LABEL_WIDTH }}
                        className="flex shrink-0 items-center gap-1 border-r border-neutral-100 px-2 py-2"
                      >
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">
                          {user.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-neutral-400">{tasks.length}</span>
                      </div>
                      <div className="flex">
                        {weeks.map((w, i) => (
                          <div
                            key={i}
                            title={`${w.label}: ${weekly[i] ?? 0}%`}
                            className={w.isMonthStart ? "border-l border-neutral-200" : ""}
                            style={{
                              width: WEEK_WIDTH,
                              height: 20,
                              backgroundColor: colorForPct(weekly[i] ?? 0, threshold),
                              opacity: (weekly[i] ?? 0) > 0 ? 1 : 0.25,
                            }}
                          />
                        ))}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-neutral-100 bg-neutral-50/50 pb-1">
                        {tasks.length === 0 ? (
                          <p className="px-2 py-2 text-xs text-neutral-400">目前沒有指派中的任務</p>
                        ) : (
                          tasks.map((t) => {
                            const hasRange = t.startDate && t.endDate;
                            const startIdx = hasRange ? weekIndexForDate(t.startDate!, weeks) : 0;
                            const endIdx = hasRange ? weekIndexForDate(t.endDate!, weeks) : 0;
                            return (
                              <div key={`${t.boardId}-${t.itemId}`} className="flex items-center">
                                <div
                                  style={{ width: LABEL_WIDTH }}
                                  className="shrink-0 truncate border-r border-neutral-100 px-2 py-1 text-xs text-neutral-600"
                                  title={t.itemName}
                                >
                                  <Link href={`/boards/${t.boardId}`} className="hover:text-blue-600">
                                    {t.itemName}
                                  </Link>
                                </div>
                                <div className="relative" style={{ width: timelineWidth, height: 18 }}>
                                  {hasRange && (
                                    <div
                                      className="absolute top-0.5 flex h-3.5 items-center justify-center overflow-hidden rounded-sm text-[9px] font-medium text-white"
                                      style={{
                                        left: startIdx * WEEK_WIDTH,
                                        width: (endIdx - startIdx + 1) * WEEK_WIDTH,
                                        backgroundColor: colorForPct(t.allocationPct, threshold),
                                      }}
                                      title={`${t.allocationPct}%`}
                                    >
                                      {t.allocationPct}%
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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
