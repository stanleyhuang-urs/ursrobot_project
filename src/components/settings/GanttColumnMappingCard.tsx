"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnData } from "@/types/board";
import {
  setGanttStartColumn,
  setGanttDurationColumn,
  setGanttEndColumn,
  setPredColumn,
  setLinkColumn,
  setGanttLagColumn,
  setGanttTypeColumn,
} from "@/lib/actions/column";
import { recomputeBoardSchedule } from "@/lib/actions/predecessorSchedule";

export type GanttMappingBoard = {
  id: string;
  name: string;
  columns: ColumnData[];
  ganttStartColumnId: string | null;
  ganttDurationColumnId: string | null;
  ganttEndColumnId: string | null;
  predColumnId: string | null;
  linkColumnId: string | null;
  lagColumnId: string | null;
  typeColumnId: string | null;
};

function BoardGanttMapping({ board }: { board: GanttMappingBoard }) {
  const router = useRouter();
  const [recomputing, setRecomputing] = useState(false);

  const dateColumns = board.columns.filter((c) => c.type === "DATE");
  const numberColumns = board.columns.filter((c) => c.type === "NUMBER");
  const textColumns = board.columns.filter((c) => c.type === "TEXT");
  const statusColumns = board.columns.filter((c) => c.type === "STATUS");

  // Changing which column drives Start/Days/Finish/Pred/Link/Type/Lag affects
  // every item's displayed schedule and lock state board-wide, so confirm
  // before applying — same as the per-board Gantt view's own settings row.
  function confirmChange(fieldLabel: string, currentId: string | null, nextValue: string, columns: ColumnData[]): boolean {
    const currentLabel = currentId ? (columns.find((c) => c.id === currentId)?.name ?? currentId) : "未設定";
    const nextLabel = nextValue ? (columns.find((c) => c.id === nextValue)?.name ?? nextValue) : "未設定";
    if (currentLabel === nextLabel) return true;
    return window.confirm(
      `確定要將「${board.name}」的「${fieldLabel}」從「${currentLabel}」改為「${nextLabel}」嗎?這會影響該看板的甘特圖計算(時程顯示、鎖定判斷、自動排程)。`
    );
  }

  async function handleRecomputeAll() {
    if (!window.confirm(`將重新計算「${board.name}」所有有前置依賴的項目時間,確定繼續?`)) return;
    setRecomputing(true);
    try {
      await recomputeBoardSchedule(board.id);
    } finally {
      setRecomputing(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <p className="mb-3 text-sm font-medium text-neutral-900">{board.name}</p>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">開始日期欄位</span>
          <select
            value={board.ganttStartColumnId ?? ""}
            onChange={(e) => {
              if (!confirmChange("開始日期欄位", board.ganttStartColumnId, e.target.value, dateColumns)) return;
              setGanttStartColumn(board.id, e.target.value || null).then(() => router.refresh());
            }}
            className="rounded-md border border-neutral-300 px-2 py-1 outline-none focus:border-blue-500"
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
            value={board.ganttDurationColumnId ?? ""}
            onChange={(e) => {
              if (!confirmChange("天數欄位", board.ganttDurationColumnId, e.target.value, numberColumns)) return;
              setGanttDurationColumn(board.id, e.target.value || null).then(() => router.refresh());
            }}
            className="rounded-md border border-neutral-300 px-2 py-1 outline-none focus:border-blue-500"
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
            value={board.ganttEndColumnId ?? ""}
            onChange={(e) => {
              if (!confirmChange("結束日期欄位", board.ganttEndColumnId, e.target.value, dateColumns)) return;
              setGanttEndColumn(board.id, e.target.value || null).then(() => router.refresh());
            }}
            className="rounded-md border border-neutral-300 px-2 py-1 outline-none focus:border-blue-500"
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
            value={board.predColumnId ?? ""}
            onChange={(e) => {
              if (!confirmChange("前置依賴欄位", board.predColumnId, e.target.value, textColumns)) return;
              setPredColumn(board.id, e.target.value || null).then(() => router.refresh());
            }}
            className="rounded-md border border-neutral-300 px-2 py-1 outline-none focus:border-blue-500"
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
            value={board.linkColumnId ?? ""}
            onChange={(e) => {
              if (!confirmChange("關聯類型欄位", board.linkColumnId, e.target.value, statusColumns)) return;
              setLinkColumn(board.id, e.target.value || null).then(() => router.refresh());
            }}
            className="rounded-md border border-neutral-300 px-2 py-1 outline-none focus:border-blue-500"
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
            value={board.typeColumnId ?? ""}
            onChange={(e) => {
              if (!confirmChange("Type 欄位", board.typeColumnId, e.target.value, statusColumns)) return;
              setGanttTypeColumn(board.id, e.target.value || null).then(() => router.refresh());
            }}
            className="rounded-md border border-neutral-300 px-2 py-1 outline-none focus:border-blue-500"
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
            value={board.lagColumnId ?? ""}
            onChange={(e) => {
              if (!confirmChange("Lag 欄位", board.lagColumnId, e.target.value, numberColumns)) return;
              setGanttLagColumn(board.id, e.target.value || null).then(() => router.refresh());
            }}
            className="rounded-md border border-neutral-300 px-2 py-1 outline-none focus:border-blue-500"
          >
            <option value="">未設定</option>
            {numberColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {board.predColumnId && board.linkColumnId && (
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
    </div>
  );
}

export function GanttColumnMappingCard({ boards }: { boards: GanttMappingBoard[] }) {
  return (
    <div className="max-w-3xl rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <p className="mb-1 text-sm font-medium text-neutral-900">甘特圖欄位設定</p>
      <p className="mb-3 text-xs text-neutral-500">
        設定每個看板的甘特圖用哪些欄位驅動開始日期/天數/結束日期/前置依賴/關聯類型/Type/Lag。
      </p>
      <div className="space-y-3">
        {boards.map((board) => (
          <BoardGanttMapping key={board.id} board={board} />
        ))}
        {boards.length === 0 && <p className="text-sm text-neutral-400">尚無看板</p>}
      </div>
    </div>
  );
}
