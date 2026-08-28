"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, CalendarOff, Star } from "lucide-react";
import type { BoardWithData, ItemData, UserOption } from "@/types/board";
import type { GanttDurationMode, Holiday, UserRole } from "@prisma/client";
import { canManageStructure, canEditGanttItem } from "@/lib/permissions";
import { isItemAssignedToUser } from "@/lib/itemAssignment";
import {
  setGanttStartColumn,
  setGanttDurationColumn,
  setGanttEndColumn,
  setGanttDurationMode,
  setPredColumn,
  setLinkColumn,
  setGanttLagColumn,
  setGanttTypeColumn,
} from "@/lib/actions/column";
import { computeRolledUpDateRange, computeDailyLoadByUser, type DateRange } from "@/lib/gantt";
import { countDaysInRange, endFromStartAndDays } from "@/lib/workday";
import { resolveLockedScheduleFields } from "@/lib/predecessorLink";
import { resizeItemBar, moveItemBar } from "@/lib/actions/ganttResize";
import { recomputeBoardSchedule } from "@/lib/actions/predecessorSchedule";
import { getStatusOptions } from "@/types/column";
import { computeVisibleItemIds, type ActiveFilter } from "@/lib/filter";
import { AssignmentModal } from "./AssignmentModal";
import { FilterBar } from "./FilterBar";
import { HolidaySettingsModal } from "@/components/dashboard/HolidaySettingsModal";

type Zoom = "day" | "week" | "month";
const ZOOM_DAY_WIDTH: Record<Zoom, number> = { day: 34, week: 10, month: 3 };
const LABEL_WIDTH = 260;

type HeaderSegment = { key: string; label: string; days: number };

function buildHeaderSegments(days: Date[], zoom: Zoom): HeaderSegment[] {
  if (zoom === "day") {
    return days.map((d) => ({ key: toIsoDate(d), label: formatDay(d), days: 1 }));
  }
  const segments: HeaderSegment[] = [];
  let bucket: Date[] = [];
  function flush() {
    if (bucket.length === 0) return;
    const start = bucket[0];
    segments.push({
      key: toIsoDate(start),
      label: zoom === "week" ? formatDay(start) : `${start.getFullYear()}/${start.getMonth() + 1}`,
      days: bucket.length,
    });
    bucket = [];
  }
  for (const d of days) {
    const startsNewBucket =
      bucket.length > 0 &&
      (zoom === "week" ? d.getDay() === 1 : d.getDate() === 1);
    if (startsNewBucket) flush();
    bucket.push(d);
  }
  flush();
  return segments;
}
const ASSIGNEE_COLORS = [
  "#579bfc",
  "#00c875",
  "#fdab3d",
  "#e2445c",
  "#a25ddc",
  "#66ccff",
  "#ff642e",
  "#037f4c",
];

function colorForUser(userId: string, users: UserOption[]) {
  const idx = users.findIndex((u) => u.id === userId);
  return ASSIGNEE_COLORS[(idx < 0 ? 0 : idx) % ASSIGNEE_COLORS.length];
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isWeekendDay(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function formatDay(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function BoardGantt({
  board,
  users,
  userRole,
  currentUserId,
  holidays,
  onNavigateToItem,
}: {
  board: BoardWithData;
  users: UserOption[];
  userRole: UserRole;
  currentUserId: string;
  holidays: Holiday[];
  onNavigateToItem?: (itemId: string) => void;
}) {
  const canEditStructure = canManageStructure(userRole);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [assignmentItem, setAssignmentItem] = useState<ItemData | null>(null);
  const [holidaySettingsOpen, setHolidaySettingsOpen] = useState(false);
  const [zoom, setZoom] = useState<Zoom>("day");
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const [groupFilterId, setGroupFilterId] = useState("");
  const [parentFilterId, setParentFilterId] = useState("");
  const durationMode = board.ganttDurationMode;
  const isBusinessMode = durationMode === "BUSINESS";
  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);
  const holidayNameByDate = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);
  function isHoliday(d: Date) {
    return holidaySet.has(toIsoDate(d));
  }
  /** Weekend/holiday tint for a day column — shown regardless of duration
   *  mode as a reference; holidays are additionally removed from the
   *  timeline entirely in BUSINESS mode (see `days` below), so this only
   *  ever paints them in CALENDAR mode. */
  function dayShade(d: Date): string | undefined {
    if (isHoliday(d)) return "#fde2e2";
    if (isWeekendDay(d)) return "#e9ecef";
    return undefined;
  }
  const dayWidth = ZOOM_DAY_WIDTH[zoom];
  const scrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const today = useMemo(() => new Date(new Date().toISOString().slice(0, 10)), []);

  function syncFromTopScroll() {
    if (scrollRef.current && topScrollRef.current) {
      scrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  }

  function syncFromMainScroll() {
    if (scrollRef.current && topScrollRef.current) {
      topScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    const container = scrollRef.current;
    if (!container) return;
    dragState.current = { startX: e.clientX, startScrollLeft: container.scrollLeft };
    setIsPanning(true);
    container.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current || !scrollRef.current) return;
    scrollRef.current.scrollLeft = dragState.current.startScrollLeft - (e.clientX - dragState.current.startX);
    syncFromMainScroll();
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragState.current = null;
    setIsPanning(false);
    scrollRef.current?.releasePointerCapture(e.pointerId);
  }

  const startColumnId = board.ganttStartColumnId;
  const durationColumnId = board.ganttDurationColumnId;
  const endColumnId = board.ganttEndColumnId;
  const predColumnId = board.predColumnId;
  const linkColumnId = board.linkColumnId;
  const lagColumnId = board.lagColumnId;
  const typeColumnId = board.typeColumnId;
  const dateColumns = board.columns.filter((c) => c.type === "DATE");
  const numberColumns = board.columns.filter((c) => c.type === "NUMBER");
  const textColumns = board.columns.filter((c) => c.type === "TEXT");
  const statusColumns = board.columns.filter((c) => c.type === "STATUS");

  const lockedScheduleFields = useMemo(() => {
    const linkColumn = board.columns.find((c) => c.id === linkColumnId);
    const typeColumn = board.columns.find((c) => c.id === typeColumnId);
    return resolveLockedScheduleFields(
      board.items,
      predColumnId,
      linkColumnId,
      linkColumn?.options,
      typeColumnId,
      typeColumn?.options
    );
  }, [board.items, board.columns, predColumnId, linkColumnId, typeColumnId]);

  const typeOptions = useMemo(() => {
    const typeColumn = board.columns.find((c) => c.id === typeColumnId);
    return getStatusOptions(typeColumn?.options);
  }, [board.columns, typeColumnId]);

  function isMilestone(item: ItemData): boolean {
    if (!typeColumnId) return false;
    const value = item.cellValues.find((cv) => cv.columnId === typeColumnId)?.value;
    return typeOptions.find((o) => o.id === value)?.label === "Milestone";
  }

  const [recomputing, setRecomputing] = useState(false);
  async function handleRecomputeAll() {
    if (!window.confirm("將重新計算所有有前置依賴的項目時間,確定繼續?")) return;
    setRecomputing(true);
    try {
      await recomputeBoardSchedule(board.id);
    } finally {
      setRecomputing(false);
    }
  }

  const ranges = useMemo(() => {
    const map = new Map<string, DateRange>();
    if (!startColumnId || !durationColumnId) return map;
    for (const item of board.items) {
      const range = computeRolledUpDateRange(item, board.items, startColumnId, durationColumnId, durationMode, holidaySet);
      if (!range) continue;
      map.set(item.id, isMilestone(item) ? { start: range.start, end: range.start } : range);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.items, startColumnId, durationColumnId, durationMode, holidaySet, typeColumnId, typeOptions]);

  const days = useMemo(() => {
    if (ranges.size === 0) return [] as Date[];
    let min = Infinity;
    let max = -Infinity;
    for (const { start, end } of ranges.values()) {
      min = Math.min(min, start.getTime());
      max = Math.max(max, end.getTime());
    }
    // Always include today, so the timeline can be scrolled to it even if no
    // item currently spans it.
    min = Math.min(min, today.getTime());
    max = Math.max(max, today.getTime());
    const minD = new Date(min);
    const totalDays = Math.round((max - min) / 86400000) + 1;
    const list: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(minD);
      d.setDate(d.getDate() + i);
      // In business mode a holiday takes up no width at all — the timeline
      // jumps straight to the next working/weekend day. Weekends still
      // render (shaded) as a familiar reference point.
      if (isBusinessMode && holidaySet.has(toIsoDate(d))) continue;
      list.push(d);
    }
    return list;
  }, [ranges, today, isBusinessMode, holidaySet]);

  const dayIndexByIso = useMemo(() => new Map(days.map((d, i) => [toIsoDate(d), i])), [days]);
  /** Column index for a date that may itself have been filtered out of
   *  `days` (e.g. today falling on a hidden holiday) — falls back to the
   *  count of visible days strictly before it. */
  function indexForDate(d: Date): number {
    const exact = dayIndexByIso.get(toIsoDate(d));
    if (exact !== undefined) return exact;
    let idx = 0;
    for (const day of days) {
      if (day.getTime() < d.getTime()) idx++;
      else break;
    }
    return idx;
  }

  const headerSegments = useMemo(() => buildHeaderSegments(days, zoom), [days, zoom]);
  const todayIndex = days.length > 0 ? indexForDate(today) : -1;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || todayIndex < 0) return;
    el.scrollLeft = Math.max(0, todayIndex * dayWidth - (el.clientWidth - LABEL_WIDTH) / 2);
    syncFromMainScroll();
    // Only re-center when the zoom level or the underlying day range changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, days.length]);

  const contentWidth = LABEL_WIDTH + days.length * dayWidth;

  const personColumnIds = useMemo(
    () => board.columns.filter((c) => c.type === "PERSON").map((c) => c.id),
    [board.columns]
  );

  const dailyLoad = useMemo(() => {
    if (!startColumnId || !durationColumnId) return new Map<string, Map<string, number>>();
    return computeDailyLoadByUser(
      board.items,
      startColumnId,
      durationColumnId,
      personColumnIds,
      durationMode,
      holidaySet
    );
  }, [board.items, startColumnId, durationColumnId, personColumnIds, durationMode, holidaySet]);

  const usersWithLoad = users.filter((u) => (dailyLoad.get(u.id)?.size ?? 0) > 0);

  const itemById = useMemo(() => new Map(board.items.map((i) => [i.id, i])), [board.items]);

  const visibleIds = useMemo(() => {
    let ids = computeVisibleItemIds(board.items, filters);
    if (groupFilterId) {
      const groupIds = new Set(board.items.filter((i) => i.groupId === groupFilterId).map((i) => i.id));
      ids = ids ? new Set([...ids].filter((id) => groupIds.has(id))) : groupIds;
    }
    if (parentFilterId) {
      const subtree = new Set<string>();
      const collect = (id: string) => {
        subtree.add(id);
        for (const child of board.items) {
          if (child.parentId === id) collect(child.id);
        }
      };
      collect(parentFilterId);
      ids = ids ? new Set([...ids].filter((id) => subtree.has(id))) : subtree;
    }
    return ids;
  }, [board.items, filters, groupFilterId, parentFilterId]);

  function canEditItem(item: ItemData): boolean {
    return canEditGanttItem(userRole, isItemAssignedToUser(item, personColumnIds, currentUserId));
  }

  const itemsByParent = new Map<string | null, ItemData[]>();
  for (const item of board.items) {
    if (visibleIds !== null && !visibleIds.has(item.id)) continue;
    const list = itemsByParent.get(item.parentId) ?? [];
    list.push(item);
    itemsByParent.set(item.parentId, list);
  }
  for (const list of itemsByParent.values()) {
    list.sort((a, b) => a.order - b.order);
  }
  const renderRootParentId = parentFilterId ? (itemById.get(parentFilterId)?.parentId ?? null) : null;

  function toggleCollapsed(itemId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function renderRows(parentId: string | null, depth: number): ReactNode[] {
    const children = itemsByParent.get(parentId) ?? [];
    return children.flatMap((item) => {
      const hasChildren = (itemsByParent.get(item.id)?.length ?? 0) > 0;
      const isCollapsed = collapsed.has(item.id);
      const range = ranges.get(item.id);

      const row = (
        <div key={item.id} className="flex items-stretch border-b border-neutral-100">
          <div
            className="sticky left-0 z-10 flex shrink-0 items-center gap-1 bg-white px-2 py-1.5 text-sm"
            style={{ width: LABEL_WIDTH, paddingLeft: 8 + depth * 16 }}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleCollapsed(item.id)}
                className="text-neutral-400 hover:text-neutral-700"
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
            ) : (
              <span className="w-3.5" />
            )}
            {onNavigateToItem ? (
              <button
                type="button"
                onClick={() => onNavigateToItem(item.id)}
                title="在表格中查看此項目"
                className="truncate text-left hover:text-blue-600 hover:underline"
              >
                {item.name}
              </button>
            ) : (
              <span className="truncate">{item.name}</span>
            )}
          </div>
          <div
            className="relative shrink-0"
            style={{ width: days.length * dayWidth, height: 34 }}
          >
            <div className="absolute inset-0 flex">
              {days.map((d) => (
                <div
                  key={toIsoDate(d)}
                  className="shrink-0"
                  style={{ width: dayWidth, backgroundColor: dayShade(d) ?? "transparent" }}
                />
              ))}
            </div>
            {range && (
              <GanttBar
                boardId={board.id}
                item={item}
                range={range}
                dayWidth={dayWidth}
                dayIndexByIso={dayIndexByIso}
                days={days}
                users={users}
                durationMode={durationMode}
                holidaySet={holidaySet}
                isMilestone={isMilestone(item)}
                startLocked={lockedScheduleFields.get(item.id)?.startLocked ?? false}
                endLocked={lockedScheduleFields.get(item.id)?.endLocked ?? false}
                daysLocked={lockedScheduleFields.get(item.id)?.daysLocked ?? false}
                canEdit={canEditItem(item)}
                onClick={canEditItem(item) ? () => setAssignmentItem(item) : undefined}
              />
            )}
          </div>
        </div>
      );

      if (hasChildren && !isCollapsed) {
        return [row, ...renderRows(item.id, depth + 1)];
      }
      return [row];
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="text-neutral-500">時間刻度</span>
        <div className="flex overflow-hidden rounded-md border border-neutral-200 text-xs">
          {(["day", "week", "month"] as const).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={`px-2.5 py-1 ${
                zoom === z ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {z === "day" ? "天" : z === "week" ? "週" : "月"}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">開始日期欄位</span>
          <select
            value={startColumnId ?? ""}
            onChange={(e) => setGanttStartColumn(board.id, e.target.value || null)}
            disabled={!canEditStructure}
            className="rounded-md border border-neutral-300 px-2 py-1 outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">未設定</option>
            {dateColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">天數欄位</span>
          <select
            value={durationColumnId ?? ""}
            onChange={(e) => setGanttDurationColumn(board.id, e.target.value || null)}
            disabled={!canEditStructure}
            className="rounded-md border border-neutral-300 px-2 py-1 outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">未設定</option>
            {numberColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">計算方式</span>
          <select
            value={durationMode}
            onChange={(e) => setGanttDurationMode(board.id, e.target.value as "CALENDAR" | "BUSINESS")}
            disabled={!canEditStructure}
            className="rounded-md border border-neutral-300 px-2 py-1 outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="CALENDAR">日曆天</option>
            <option value="BUSINESS">工作天</option>
          </select>
        </div>
        {userRole === "ADMIN" && (
          <button
            type="button"
            onClick={() => setHolidaySettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            <CalendarOff size={13} /> 國定假日設定
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">結束日期欄位</span>
          <select
            value={endColumnId ?? ""}
            onChange={(e) => setGanttEndColumn(board.id, e.target.value || null)}
            disabled={!canEditStructure}
            className="rounded-md border border-neutral-300 px-2 py-1 outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">未設定</option>
            {dateColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">前置依賴欄位</span>
          <select
            value={predColumnId ?? ""}
            onChange={(e) => setPredColumn(board.id, e.target.value || null)}
            disabled={!canEditStructure}
            className="rounded-md border border-neutral-300 px-2 py-1 outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">未設定</option>
            {textColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">關聯類型欄位</span>
          <select
            value={linkColumnId ?? ""}
            onChange={(e) => setLinkColumn(board.id, e.target.value || null)}
            disabled={!canEditStructure}
            className="rounded-md border border-neutral-300 px-2 py-1 outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">未設定</option>
            {statusColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Type 欄位</span>
          <select
            value={typeColumnId ?? ""}
            onChange={(e) => setGanttTypeColumn(board.id, e.target.value || null)}
            disabled={!canEditStructure}
            className="rounded-md border border-neutral-300 px-2 py-1 outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">未設定</option>
            {statusColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Lag 欄位</span>
          <select
            value={lagColumnId ?? ""}
            onChange={(e) => setGanttLagColumn(board.id, e.target.value || null)}
            disabled={!canEditStructure}
            className="rounded-md border border-neutral-300 px-2 py-1 outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">未設定</option>
            {numberColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {canEditStructure && predColumnId && linkColumnId && (
          <button
            type="button"
            onClick={handleRecomputeAll}
            disabled={recomputing}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
          >
            {recomputing ? "重算中..." : "重算全部"}
          </button>
        )}
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">專案(分組)</span>
          <select
            value={groupFilterId}
            onChange={(e) => setGroupFilterId(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
          >
            <option value="">全部</option>
            {board.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">父項目</span>
          <select
            value={parentFilterId}
            onChange={(e) => setParentFilterId(e.target.value)}
            className="max-w-[200px] rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
          >
            <option value="">全部</option>
            {board.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        {(groupFilterId || parentFilterId) && (
          <button
            type="button"
            onClick={() => {
              setGroupFilterId("");
              setParentFilterId("");
            }}
            className="text-xs text-neutral-400 hover:text-neutral-700"
          >
            清除
          </button>
        )}
      </div>
      <FilterBar columns={board.columns} users={users} filters={filters} onChange={setFilters} />
      {predColumnId && linkColumnId && startColumnId && endColumnId && (
        <p className="mb-2 text-xs text-neutral-400">
          已啟用前置依賴自動計算:依前置依賴欄位與日期自動判斷 FS/FF/SS/SF 並寫入關聯類型欄位。
        </p>
      )}
      {startColumnId && durationColumnId && endColumnId && (
        <p className="mb-2 text-xs text-neutral-400">
          已啟用自動計算:填寫開始日期+天數會自動算出結束日期,填寫開始日期+結束日期會自動算出天數
          {isBusinessMode
            ? `(以工作日計算,已排除週六日與 ${holidays.length} 個國定假日)`
            : "(以日曆天計算)"}
          。
        </p>
      )}

      {(!startColumnId || !durationColumnId) && (
        <p className="text-sm text-neutral-400">
          請先選擇開始日期欄位與天數欄位,才能顯示甘特圖時間軸。
        </p>
      )}

      {startColumnId && durationColumnId && days.length === 0 && (
        <p className="text-sm text-neutral-400">
          目前沒有項目同時填寫了開始日期與天數。
        </p>
      )}

      {startColumnId && durationColumnId && days.length > 0 && (
        <>
          <div
            ref={topScrollRef}
            onScroll={syncFromTopScroll}
            className="mb-1 overflow-x-auto overflow-y-hidden"
            style={{ height: 14 }}
          >
            <div style={{ width: contentWidth, height: 1 }} />
          </div>
          <div
            ref={scrollRef}
            onScroll={syncFromMainScroll}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className={`overflow-auto rounded-md border border-neutral-200 bg-white ${
              isPanning ? "cursor-grabbing select-none" : "cursor-grab"
            }`}
          >
          <div className="relative" style={{ minWidth: LABEL_WIDTH + days.length * dayWidth }}>
            {todayIndex >= 0 && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-[5] w-px bg-red-400"
                style={{ left: LABEL_WIDTH + todayIndex * dayWidth }}
                title="今天"
              />
            )}
            <div className="flex">
              <div
                className="sticky left-0 shrink-0 border-b border-r border-neutral-100 bg-neutral-50 px-2 py-1.5 text-xs font-medium text-neutral-500"
                style={{ width: LABEL_WIDTH }}
              >
                項目
              </div>
              <div className="flex border-b border-neutral-100 bg-neutral-50">
                {headerSegments.map((seg) => {
                  const segDate = zoom === "day" ? new Date(seg.key) : null;
                  const holidayName = segDate ? holidayNameByDate.get(toIsoDate(segDate)) : undefined;
                  return (
                    <div
                      key={seg.key}
                      title={holidayName}
                      className="shrink-0 truncate border-r border-neutral-100 py-1.5 text-center text-xs text-neutral-500"
                      style={{ width: seg.days * dayWidth, backgroundColor: segDate ? dayShade(segDate) : undefined }}
                    >
                      {seg.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {renderRows(renderRootParentId, 0)}

          {usersWithLoad.length > 0 && (
            <div>
              <div className="flex border-t-2 border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs font-medium text-neutral-500">
                人員負載
              </div>
              {usersWithLoad.map((u) => (
                <div key={u.id} className="flex items-stretch border-b border-neutral-100">
                  <div
                    className="sticky left-0 z-10 flex shrink-0 items-center bg-white px-2 py-1.5 text-sm"
                    style={{ width: LABEL_WIDTH }}
                  >
                    {u.name}
                  </div>
                  <div className="flex shrink-0">
                    {days.map((d) => {
                      const load = dailyLoad.get(u.id)?.get(toIsoDate(d)) ?? 0;
                      const bg =
                        load === 0
                          ? (dayShade(d) ?? "transparent")
                          : load > 100
                            ? "#e2445c"
                            : "#00c875";
                      return (
                        <div
                          key={toIsoDate(d)}
                          title={load > 0 ? `${formatDay(d)}: ${load}%` : undefined}
                          className="shrink-0 border-r border-neutral-100"
                          style={{
                            width: dayWidth,
                            height: 24,
                            backgroundColor: bg,
                            opacity: load > 0 ? Math.min(1, 0.35 + load / 200) : 1,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
          </div>
        </>
      )}

      <AssignmentModal
        boardId={board.id}
        item={assignmentItem}
        users={users}
        currentUserId={currentUserId}
        userRole={userRole}
        open={assignmentItem !== null}
        onOpenChange={(open) => !open && setAssignmentItem(null)}
      />

      {userRole === "ADMIN" && (
        <HolidaySettingsModal
          holidays={holidays}
          open={holidaySettingsOpen}
          onOpenChange={setHolidaySettingsOpen}
        />
      )}
    </div>
  );
}

/** Builds the confirm-dialog text for a Gantt drag: the day range before and
 *  after, and the resulting change in Days — shown before any drag (resize
 *  or whole-bar move) is actually applied. For a whole-bar move, `fixedDays`
 *  is the Days value the move is known to preserve exactly — passing it
 *  skips re-deriving a business-day count from the raw dates, which can
 *  disagree with the stored Days value when the (unmoved) Start itself
 *  falls on a non-working day. */
function describeScheduleChange(
  oldStart: Date,
  oldEnd: Date,
  newStart: Date,
  newEnd: Date,
  mode: GanttDurationMode,
  holidays: Set<string>,
  fixedDays?: number
): string {
  const oldDays = fixedDays ?? countDaysInRange(oldStart, oldEnd, mode, holidays);
  const newDays = fixedDays ?? countDaysInRange(newStart, newEnd, mode, holidays);
  const delta = (newDays ?? 0) - (oldDays ?? 0);
  const deltaLabel = delta === 0 ? "天數不變" : delta > 0 ? `增加 ${delta} 天` : `減少 ${Math.abs(delta)} 天`;
  return [
    `開始日期:${toIsoDate(oldStart)} → ${toIsoDate(newStart)}`,
    `結束日期:${toIsoDate(oldEnd)} → ${toIsoDate(newEnd)}`,
    `天數:${oldDays ?? "-"} → ${newDays ?? "-"}(${deltaLabel})`,
    "",
    "確定要套用這個時程調整嗎?",
  ].join("\n");
}

function GanttBar({
  boardId,
  item,
  range,
  dayWidth,
  dayIndexByIso,
  days,
  users,
  durationMode,
  holidaySet,
  isMilestone,
  startLocked,
  endLocked,
  daysLocked,
  canEdit,
  onClick,
}: {
  boardId: string;
  item: ItemData;
  range: DateRange;
  dayWidth: number;
  dayIndexByIso: Map<string, number>;
  days: Date[];
  users: UserOption[];
  durationMode: GanttDurationMode;
  holidaySet: Set<string>;
  isMilestone: boolean;
  startLocked: boolean;
  endLocked: boolean;
  daysLocked: boolean;
  canEdit: boolean;
  onClick?: () => void;
}) {
  const startIndex = dayIndexByIso.get(toIsoDate(range.start)) ?? 0;
  const endIndex = dayIndexByIso.get(toIsoDate(range.end)) ?? startIndex;
  const [preview, setPreview] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const dragRef = useRef<{
    edge: "start" | "end" | "move";
    originStartIndex: number;
    originEndIndex: number;
    originX: number;
  } | null>(null);

  const canResizeStart = canEdit && !startLocked && !daysLocked;
  const canResizeEnd = canEdit && !endLocked && !daysLocked;
  const canMove = canEdit && !startLocked && !endLocked;

  const displayStart = preview?.startIndex ?? startIndex;
  const displayEnd = preview?.endIndex ?? endIndex;
  const left = displayStart * dayWidth;
  const width = (displayEnd - displayStart + 1) * dayWidth;
  const totalPct = item.assignments.reduce((sum, a) => sum + a.allocationPct, 0);
  // The bar's current Days value, held fixed while moving — a move must
  // preserve it exactly, even though a fixed calendar-day span can cover a
  // different number of business days once it crosses a weekend/holiday.
  const fixedDurationDays = countDaysInRange(range.start, range.end, durationMode, holidaySet) ?? 1;

  function handleResizeDown(edge: "start" | "end", e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { edge, originStartIndex: startIndex, originEndIndex: endIndex, originX: e.clientX };
    setPreview({ startIndex, endIndex });
  }

  function handleBodyPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!onClick) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { edge: "move", originStartIndex: startIndex, originEndIndex: endIndex, originX: e.clientX };
    setPreview({ startIndex, endIndex });
  }

  function handleResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaIndex = Math.round((e.clientX - drag.originX) / dayWidth);
    const maxIndex = days.length - 1;
    if (drag.edge === "start") {
      const next = Math.max(0, Math.min(drag.originStartIndex + deltaIndex, drag.originEndIndex));
      setPreview({ startIndex: next, endIndex: drag.originEndIndex });
    } else if (drag.edge === "end") {
      const next = Math.min(maxIndex, Math.max(drag.originEndIndex + deltaIndex, drag.originStartIndex));
      setPreview({ startIndex: drag.originStartIndex, endIndex: next });
    } else {
      if (!canMove) return;
      const newStartIndex = Math.max(0, drag.originStartIndex + deltaIndex);
      const newStartDate = days[newStartIndex];
      if (!newStartDate) return;
      const trueEnd = endFromStartAndDays(newStartDate, fixedDurationDays, durationMode, holidaySet);
      const trueEndIndex = dayIndexByIso.get(toIsoDate(trueEnd));
      if (trueEndIndex === undefined || trueEndIndex > maxIndex) return;
      setPreview({ startIndex: newStartIndex, endIndex: trueEndIndex });
    }
  }

  async function handleResizeUp(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    const drag = dragRef.current;
    dragRef.current = null;
    const result = preview;
    setPreview(null);
    if (!drag || !result) return;

    if (drag.edge === "move") {
      if (!canMove || result.startIndex === drag.originStartIndex) {
        onClick?.();
        return;
      }
      const newStart = days[result.startIndex];
      const newEnd = days[result.endIndex];
      if (!newStart || !newEnd) return;
      const message = describeScheduleChange(
        range.start,
        range.end,
        newStart,
        newEnd,
        durationMode,
        holidaySet,
        fixedDurationDays
      );
      if (!window.confirm(message)) return;
      try {
        await moveItemBar(boardId, item.id, toIsoDate(newStart));
      } catch (err) {
        alert(err instanceof Error ? err.message : "調整失敗");
      }
      return;
    }

    const newIndex = drag.edge === "start" ? result.startIndex : result.endIndex;
    const originalIndex = drag.edge === "start" ? startIndex : endIndex;
    if (newIndex === originalIndex) return;
    const newDate = days[newIndex];
    if (!newDate) return;
    const newStart = drag.edge === "start" ? newDate : range.start;
    const newEnd = drag.edge === "end" ? newDate : range.end;
    const message = describeScheduleChange(range.start, range.end, newStart, newEnd, durationMode, holidaySet);
    if (!window.confirm(message)) return;

    try {
      await resizeItemBar(boardId, item.id, drag.edge, toIsoDate(newDate));
    } catch (err) {
      alert(err instanceof Error ? err.message : "調整失敗");
    }
  }

  return (
    <div className="absolute top-1/2 -translate-y-1/2" style={{ left, width, height: 20 }}>
      {canResizeStart && (
        <div
          onPointerDown={(e) => handleResizeDown("start", e)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-col-resize rounded-l hover:bg-blue-500/60"
          title="拖曳調整開始日期"
        />
      )}
      <div
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onPointerDown={handleBodyPointerDown}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        onKeyDown={(e) => {
          if (onClick && (e.key === "Enter" || e.key === " ")) onClick();
        }}
        className="absolute inset-0 flex overflow-hidden rounded"
        style={{ cursor: canMove ? "grab" : onClick ? "pointer" : "default" }}
        title={
          isMilestone
            ? `里程碑:${toIsoDate(range.start)}`
            : item.assignments.map((a) => `${a.user.name} ${a.allocationPct}%`).join(", ")
        }
      >
        {isMilestone ? (
          <div className="flex h-full w-full items-center justify-center">
            <Star size={16} className="fill-amber-400 text-amber-500" />
          </div>
        ) : item.assignments.length === 0 ? (
          <div className="h-full w-full bg-neutral-300" />
        ) : (
          item.assignments.map((a) => (
            <div
              key={a.userId}
              className="flex h-full items-center justify-center overflow-hidden text-[10px] font-medium text-white"
              style={{
                width: `${(a.allocationPct / totalPct) * 100}%`,
                backgroundColor: colorForUser(a.userId, users),
              }}
            >
              {a.user.name.slice(0, 2)}
            </div>
          ))
        )}
      </div>
      {canResizeEnd && (
        <div
          onPointerDown={(e) => handleResizeDown("end", e)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize rounded-r hover:bg-blue-500/60"
          title="拖曳調整結束日期"
        />
      )}
    </div>
  );
}
