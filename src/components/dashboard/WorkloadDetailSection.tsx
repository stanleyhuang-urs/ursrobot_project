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
const DAY_MS = 86_400_000;

type ParentTaskOption = { boardId: string; boardName: string; itemId: string; itemName: string };

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  return toIsoDate(new Date(new Date(iso).getTime() + days * DAY_MS));
}

function daysBetweenIso(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / DAY_MS) + 1;
}

export function WorkloadDetailSection({
  users,
  tasksByUser,
  weeks,
  weeklyLoadByUser,
  threshold,
  canManageThreshold,
  canCreateSubtask,
  parentTaskOptions,
}: {
  users: { id: string; name: string }[];
  tasksByUser: Record<string, MemberTask[]>;
  weeks: WeekColumn[];
  weeklyLoadByUser: Record<string, number[]>;
  threshold: WorkloadThresholdSettings;
  canManageThreshold: boolean;
  canCreateSubtask: boolean;
  parentTaskOptions: ParentTaskOption[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [creatingForUserId, setCreatingForUserId] = useState<string | null>(null);
  const [anchorIdx, setAnchorIdx] = useState<number | null>(null);
  const [formStartDate, setFormStartDate] = useState("");
  const [formDays, setFormDays] = useState(7);
  const [formPct, setFormPct] = useState(100);
  const [formName, setFormName] = useState("");
  const [formParentId, setFormParentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const timelineWidth = weeks.length * WEEK_WIDTH;
  const timelineOrigin = weeks[0]?.start ?? null;

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
    setAnchorIdx(null);
    setFormStartDate(toIsoDate(new Date()));
    setFormDays(7);
    setFormPct(100);
    setFormName("");
    setFormParentId(parentTaskOptions[0]?.itemId ?? "");
    setFormError(null);
  }

  function resetCreating() {
    setCreatingForUserId(null);
    setAnchorIdx(null);
    setFormStartDate("");
    setFormDays(7);
    setFormPct(100);
    setFormName("");
    setFormParentId("");
    setFormError(null);
  }

  /** Clicking the timeline is a rough quick-pick: first click sets a fixed
   *  anchor week, every click after that redraws [anchor, click] as whole
   *  weeks into the Start/Days fields below — which stay freely editable
   *  for day-level precision afterward. */
  function handleWeekClick(userId: string, weekIdx: number) {
    if (creatingForUserId !== userId) return;
    if (anchorIdx === null) {
      setAnchorIdx(weekIdx);
      setFormStartDate(toIsoDate(weeks[weekIdx].start));
      setFormDays(7);
      return;
    }
    const start = Math.min(anchorIdx, weekIdx);
    const end = Math.max(anchorIdx, weekIdx);
    setFormStartDate(toIsoDate(weeks[start].start));
    setFormDays((end - start + 1) * 7);
  }

  function handleEndDateChange(value: string) {
    if (!formStartDate || !value) return;
    const days = daysBetweenIso(formStartDate, value);
    if (days >= 1) setFormDays(days);
  }

  function handleDaysChange(value: number) {
    if (Number.isFinite(value) && value >= 1) setFormDays(Math.round(value));
  }

  async function handleCreate(userId: string) {
    if (!formParentId) {
      setFormError("請選擇父任務");
      return;
    }
    if (!formStartDate) {
      setFormError("請輸入起始日期");
      return;
    }
    if (!Number.isFinite(formDays) || formDays < 1) {
      setFormError("天數需大於 0");
      return;
    }
    if (!Number.isFinite(formPct) || formPct < 1 || formPct > 100) {
      setFormError("百分比需介於 1 到 100 之間");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createTeamSubtask({
        parentItemId: formParentId,
        assigneeUserId: userId,
        name: formName.trim() || "新任務",
        startDate: formStartDate,
        days: formDays,
        allocationPct: formPct,
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

                // Day-precise range for this user's in-progress pick, expressed
                // as an offset in days from the timeline's first week — used to
                // draw both the fractional overlay bar and the week highlight.
                const rangeStartDays =
                  isCreating && formStartDate && timelineOrigin
                    ? (new Date(formStartDate).getTime() - timelineOrigin.getTime()) / DAY_MS
                    : null;
                const rangeEndDays = rangeStartDays !== null ? rangeStartDays + formDays - 1 : null;
                const rangeLeftPx = rangeStartDays !== null ? (rangeStartDays / 7) * WEEK_WIDTH : 0;
                const formEndDate = formStartDate ? addDaysIso(formStartDate, formDays - 1) : "";

                const overlappingWeekLoad =
                  rangeStartDays !== null && rangeEndDays !== null
                    ? weeks
                        .map((_, i) => i)
                        .filter((i) => i * 7 + 6 >= rangeStartDays && i * 7 <= rangeEndDays)
                        .map((i) => weekly[i] ?? 0)
                    : [];
                const existingLoad = Math.max(0, ...overlappingWeekLoad);
                const projectedMax = existingLoad + formPct;

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

                        {canCreateSubtask && parentTaskOptions.length > 0 && (
                          isCreating ? (
                            <>
                              <div className="flex items-center">
                                <div
                                  style={{ width: LABEL_WIDTH }}
                                  className="shrink-0 border-r border-neutral-100 px-2 py-1 text-[10px] text-neutral-500"
                                >
                                  點選或於下方輸入
                                </div>
                                <div className="relative flex">
                                  {weeks.map((w, i) => {
                                    const inRange =
                                      rangeStartDays !== null &&
                                      rangeEndDays !== null &&
                                      i * 7 + 6 >= rangeStartDays &&
                                      i * 7 <= rangeEndDays;
                                    return (
                                      <button
                                        key={i}
                                        type="button"
                                        onClick={() => handleWeekClick(user.id, i)}
                                        className={w.isMonthStart ? "border-l border-neutral-200" : ""}
                                        style={{
                                          width: WEEK_WIDTH,
                                          height: 20,
                                          backgroundColor: inRange ? "#579bfc" : "#f3f4f6",
                                          cursor: "pointer",
                                        }}
                                      />
                                    );
                                  })}
                                  {rangeStartDays !== null && (
                                    <div
                                      className="pointer-events-none absolute top-0 whitespace-nowrap text-[10px] font-medium text-neutral-700"
                                      style={{
                                        left: rangeLeftPx - 6,
                                        transform: "translateX(-100%)",
                                        height: 20,
                                        lineHeight: "20px",
                                      }}
                                    >
                                      {formStartDate}~{formEndDate}・{formDays}天・{formPct}%
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="border-t border-neutral-100 bg-blue-50/40 px-2 py-2">
                                {formError && (
                                  <p className="mb-1.5 text-xs text-red-600">{formError}</p>
                                )}
                                {projectedMax > 100 && (
                                  <p className="mb-1.5 text-xs text-amber-600">
                                    ⚠ 此區間 {user.name} 已有 {existingLoad}% 負載,加上此任務 {formPct}%
                                    後最高將達 {projectedMax}%(超過 100%)
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                  <select
                                    value={formParentId}
                                    onChange={(e) => setFormParentId(e.target.value)}
                                    className="max-w-[220px] rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
                                  >
                                    {parentTaskOptions.map((t) => (
                                      <option key={`${t.boardId}-${t.itemId}`} value={t.itemId}>
                                        {t.boardName} / {t.itemName}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="任務名稱(留空預設為「新任務」)"
                                    maxLength={20}
                                    className="w-40 rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
                                  />
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                                  <label className="flex items-center gap-1 text-[10px] text-neutral-500">
                                    起始
                                    <input
                                      type="date"
                                      value={formStartDate}
                                      onChange={(e) => setFormStartDate(e.target.value)}
                                      className="rounded-md border border-neutral-300 px-1.5 py-1 text-xs outline-none focus:border-blue-500"
                                    />
                                  </label>
                                  <label className="flex items-center gap-1 text-[10px] text-neutral-500">
                                    結束
                                    <input
                                      type="date"
                                      value={formEndDate}
                                      onChange={(e) => handleEndDateChange(e.target.value)}
                                      className="rounded-md border border-neutral-300 px-1.5 py-1 text-xs outline-none focus:border-blue-500"
                                    />
                                  </label>
                                  <label className="flex items-center gap-1 text-[10px] text-neutral-500">
                                    天數
                                    <input
                                      type="number"
                                      min={1}
                                      value={formDays}
                                      onChange={(e) => handleDaysChange(Number(e.target.value))}
                                      className="w-14 rounded-md border border-neutral-300 px-1.5 py-1 text-xs outline-none focus:border-blue-500"
                                    />
                                  </label>
                                  <label className="flex items-center gap-1 text-[10px] text-neutral-500">
                                    百分比
                                    <input
                                      type="number"
                                      min={1}
                                      max={100}
                                      value={formPct}
                                      onChange={(e) => setFormPct(Number(e.target.value))}
                                      className="w-14 rounded-md border border-neutral-300 px-1.5 py-1 text-xs outline-none focus:border-blue-500"
                                    />
                                  </label>
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
