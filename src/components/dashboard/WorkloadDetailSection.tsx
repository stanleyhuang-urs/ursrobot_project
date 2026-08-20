"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, ChevronDown, ChevronRight, Plus } from "lucide-react";
import {
  colorForPct,
  weekIndexForDate,
  type WorkloadThresholdSettings,
  type MemberTask,
  type WeekColumn,
} from "@/lib/workload";
import { createTeamSubtask } from "@/lib/actions/teamTask";
import { WorkloadThresholdModal } from "./WorkloadThresholdModal";

const LABEL_WIDTH = 140;
const WEEK_WIDTH = 26;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function WorkloadDetailSection({
  users,
  tasksByUser,
  weeks,
  weeklyLoadByUser,
  threshold,
  canManageThreshold,
  canCreateSubtask,
  myOwnTasks,
}: {
  users: { id: string; name: string }[];
  tasksByUser: Record<string, MemberTask[]>;
  weeks: WeekColumn[];
  weeklyLoadByUser: Record<string, number[]>;
  threshold: WorkloadThresholdSettings;
  canManageThreshold: boolean;
  canCreateSubtask: boolean;
  myOwnTasks: MemberTask[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [creatingForUserId, setCreatingForUserId] = useState<string | null>(null);
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [pendingEnd, setPendingEnd] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formParentId, setFormParentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  function startCreating(userId: string) {
    setCreatingForUserId(userId);
    setPendingStart(null);
    setPendingEnd(null);
    setHoverIdx(null);
    setFormName("");
    setFormParentId(myOwnTasks[0]?.itemId ?? "");
    setFormError(null);
  }

  function resetCreating() {
    setCreatingForUserId(null);
    setPendingStart(null);
    setPendingEnd(null);
    setHoverIdx(null);
    setFormName("");
    setFormParentId("");
    setFormError(null);
  }

  function handleWeekClick(userId: string, weekIdx: number) {
    if (creatingForUserId !== userId) return;
    if (pendingStart === null) {
      setPendingStart(weekIdx);
    } else if (pendingEnd === null) {
      setPendingStart(Math.min(pendingStart, weekIdx));
      setPendingEnd(Math.max(pendingStart, weekIdx));
    } else {
      setPendingStart(weekIdx);
      setPendingEnd(null);
    }
  }

  async function handleCreate(userId: string) {
    if (pendingStart === null || pendingEnd === null) return;
    if (!formParentId) {
      setFormError("請選擇父任務");
      return;
    }
    if (!formName.trim()) {
      setFormError("請輸入任務名稱");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createTeamSubtask({
        parentItemId: formParentId,
        assigneeUserId: userId,
        name: formName,
        startDate: toIsoDate(weeks[pendingStart].start),
        days: (pendingEnd - pendingStart + 1) * 7,
      });
      resetCreating();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "建立失敗");
    } finally {
      setSubmitting(false);
    }
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
                const isCreating = creatingForUserId === user.id;

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
                                  <Link
                                    href={`/boards/${t.boardId}?highlight=${t.itemId}`}
                                    className="hover:text-blue-600"
                                  >
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

                        {canCreateSubtask && myOwnTasks.length > 0 && (
                          isCreating ? (
                            <>
                              <div className="flex items-center">
                                <div
                                  style={{ width: LABEL_WIDTH }}
                                  className="shrink-0 border-r border-neutral-100 px-2 py-1 text-[10px] text-neutral-500"
                                >
                                  {pendingEnd === null
                                    ? pendingStart === null
                                      ? "點選起始週"
                                      : "點選結束週"
                                    : "已選取範圍"}
                                </div>
                                <div className="flex" onMouseLeave={() => setHoverIdx(null)}>
                                  {weeks.map((w, i) => {
                                    const inFinalRange =
                                      pendingStart !== null && pendingEnd !== null && i >= pendingStart && i <= pendingEnd;
                                    const previewEnd = hoverIdx ?? pendingStart;
                                    const inPreview =
                                      pendingStart !== null &&
                                      pendingEnd === null &&
                                      previewEnd !== null &&
                                      i >= Math.min(pendingStart, previewEnd) &&
                                      i <= Math.max(pendingStart, previewEnd);
                                    const highlighted = inFinalRange || inPreview;
                                    return (
                                      <button
                                        key={i}
                                        type="button"
                                        onMouseEnter={() => setHoverIdx(i)}
                                        onClick={() => handleWeekClick(user.id, i)}
                                        className={w.isMonthStart ? "border-l border-neutral-200" : ""}
                                        style={{
                                          width: WEEK_WIDTH,
                                          height: 20,
                                          backgroundColor: highlighted ? "#579bfc" : "#f3f4f6",
                                          cursor: "pointer",
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>

                              {pendingEnd !== null ? (
                                <div className="border-t border-neutral-100 bg-blue-50/40 px-2 py-2">
                                  {formError && (
                                    <p className="mb-1.5 text-xs text-red-600">{formError}</p>
                                  )}
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input
                                      value={formName}
                                      onChange={(e) => setFormName(e.target.value)}
                                      placeholder="任務名稱"
                                      autoFocus
                                      className="min-w-[140px] flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
                                    />
                                    <select
                                      value={formParentId}
                                      onChange={(e) => setFormParentId(e.target.value)}
                                      className="max-w-[220px] rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
                                    >
                                      {myOwnTasks.map((t) => (
                                        <option key={`${t.boardId}-${t.itemId}`} value={t.itemId}>
                                          {t.boardName} / {t.itemName}
                                        </option>
                                      ))}
                                    </select>
                                    <span className="shrink-0 text-[10px] text-neutral-500">
                                      {weeks[pendingStart!].label} ~ {weeks[pendingEnd].label}(+6天)・100%
                                    </span>
                                    <button
                                      type="button"
                                      disabled={submitting}
                                      onClick={() => handleCreate(user.id)}
                                      className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      {submitting ? "建立中..." : "建立"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={resetCreating}
                                      className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                                    >
                                      取消
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="px-2 py-1">
                                  <button
                                    type="button"
                                    onClick={resetCreating}
                                    className="text-[10px] text-neutral-400 hover:text-neutral-600"
                                  >
                                    取消
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startCreating(user.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700"
                            >
                              <Plus size={12} /> 新增任務
                            </button>
                          )
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
