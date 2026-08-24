"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { BoardWithData, ItemData, UserOption } from "@/types/board";
import type { UserRole } from "@prisma/client";
import { canManageStructure } from "@/lib/permissions";
import {
  setGanttStartColumn,
  setGanttDurationColumn,
  setGanttEndColumn,
  setPredColumn,
  setLinkColumn,
} from "@/lib/actions/column";
import { getItemDateRange, computeDailyLoadByUser, type DateRange } from "@/lib/gantt";
import { AssignmentModal } from "./AssignmentModal";

type Zoom = "day" | "week" | "month";
const ZOOM_DAY_WIDTH: Record<Zoom, number> = { day: 28, week: 10, month: 3 };
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

function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function formatDay(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function BoardGantt({
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
  const canEditStructure = canManageStructure(userRole);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [assignmentItem, setAssignmentItem] = useState<ItemData | null>(null);
  const [zoom, setZoom] = useState<Zoom>("day");
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
  const dateColumns = board.columns.filter((c) => c.type === "DATE");
  const numberColumns = board.columns.filter((c) => c.type === "NUMBER");
  const textColumns = board.columns.filter((c) => c.type === "TEXT");
  const statusColumns = board.columns.filter((c) => c.type === "STATUS");

  const ranges = useMemo(() => {
    const map = new Map<string, DateRange>();
    if (!startColumnId || !durationColumnId) return map;
    for (const item of board.items) {
      const range = getItemDateRange(item, startColumnId, durationColumnId);
      if (range) map.set(item.id, range);
    }
    return map;
  }, [board.items, startColumnId, durationColumnId]);

  const { minDate, days } = useMemo(() => {
    if (ranges.size === 0) return { minDate: new Date(), days: [] as Date[] };
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
      list.push(d);
    }
    return { minDate: minD, days: list };
  }, [ranges, today]);

  const headerSegments = useMemo(() => buildHeaderSegments(days, zoom), [days, zoom]);
  const todayIndex = days.length > 0 ? diffDays(minDate, today) : -1;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || todayIndex < 0) return;
    el.scrollLeft = Math.max(0, todayIndex * dayWidth - (el.clientWidth - LABEL_WIDTH) / 2);
    syncFromMainScroll();
    // Only re-center when the zoom level or the underlying day range changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, days.length]);

  const contentWidth = LABEL_WIDTH + days.length * dayWidth;

  const dailyLoad = useMemo(() => {
    if (!startColumnId || !durationColumnId) return new Map<string, Map<string, number>>();
    return computeDailyLoadByUser(board.items, startColumnId, durationColumnId);
  }, [board.items, startColumnId, durationColumnId]);

  const usersWithLoad = users.filter((u) => (dailyLoad.get(u.id)?.size ?? 0) > 0);

  const itemsByParent = new Map<string | null, ItemData[]>();
  for (const item of board.items) {
    const list = itemsByParent.get(item.parentId) ?? [];
    list.push(item);
    itemsByParent.set(item.parentId, list);
  }
  for (const list of itemsByParent.values()) {
    list.sort((a, b) => a.order - b.order);
  }

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
            <span className="truncate">{item.name}</span>
          </div>
          <div
            className="relative shrink-0"
            style={{ width: days.length * dayWidth, height: 34 }}
          >
            {range && (
              <GanttBar
                item={item}
                range={range}
                minDate={minDate}
                dayWidth={dayWidth}
                users={users}
                onClick={canEditStructure ? () => setAssignmentItem(item) : undefined}
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
      </div>
      {predColumnId && linkColumnId && startColumnId && endColumnId && (
        <p className="mb-2 text-xs text-neutral-400">
          已啟用前置依賴自動計算:依前置依賴欄位與日期自動判斷 FS/FF/SS/SF 並寫入關聯類型欄位。
        </p>
      )}
      {startColumnId && durationColumnId && endColumnId && (
        <p className="mb-2 text-xs text-neutral-400">
          已啟用自動計算:填寫開始日期+天數會自動算出結束日期,填寫開始日期+結束日期會自動算出天數(以工作日計算)。
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
                {headerSegments.map((seg) => (
                  <div
                    key={seg.key}
                    className="shrink-0 truncate border-r border-neutral-100 py-1.5 text-center text-xs text-neutral-500"
                    style={{ width: seg.days * dayWidth }}
                  >
                    {seg.label}
                  </div>
                ))}
              </div>
            </div>

            {renderRows(null, 0)}

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
                          ? "transparent"
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
    </div>
  );
}

function GanttBar({
  item,
  range,
  minDate,
  dayWidth,
  users,
  onClick,
}: {
  item: ItemData;
  range: DateRange;
  minDate: Date;
  dayWidth: number;
  users: UserOption[];
  onClick?: () => void;
}) {
  const left = diffDays(minDate, range.start) * dayWidth;
  const width = (diffDays(range.start, range.end) + 1) * dayWidth;
  const totalPct = item.assignments.reduce((sum, a) => sum + a.allocationPct, 0);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="absolute top-1/2 flex -translate-y-1/2 overflow-hidden rounded disabled:cursor-default"
      style={{ left, width, height: 20 }}
      title={item.assignments.map((a) => `${a.user.name} ${a.allocationPct}%`).join(", ")}
    >
      {item.assignments.length === 0 ? (
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
    </button>
  );
}
