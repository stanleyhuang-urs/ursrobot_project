"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { getStatusOptions } from "@/types/column";
import { setReportStatusColumn, setReportStatusBuckets } from "@/lib/actions/column";
import type { BoardWithData } from "@/types/board";

export function ReportSettingsModal({
  board,
  open,
  onOpenChange,
}: {
  board: BoardWithData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const statusColumns = board.columns.filter((c) => c.type === "STATUS");
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set(board.reportDoneOptionIds));
  const [stuckIds, setStuckIds] = useState<Set<string>>(new Set(board.reportStuckOptionIds));
  const [saving, setSaving] = useState(false);

  const column = board.columns.find((c) => c.id === board.reportStatusColumnId);
  const options = column ? getStatusOptions(column.options) : [];

  function bucketFor(optionId: string): "in_progress" | "stuck" | "done" {
    if (doneIds.has(optionId)) return "done";
    if (stuckIds.has(optionId)) return "stuck";
    return "in_progress";
  }

  function setBucket(optionId: string, bucket: "in_progress" | "stuck" | "done") {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (bucket === "done") next.add(optionId);
      else next.delete(optionId);
      return next;
    });
    setStuckIds((prev) => {
      const next = new Set(prev);
      if (bucket === "stuck") next.add(optionId);
      else next.delete(optionId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setReportStatusBuckets(board.id, [...doneIds], [...stuckIds]);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="報表設定">
      <div className="mb-4">
        <label className="mb-1 block text-xs text-neutral-500">用哪個狀態欄位統計</label>
        <select
          value={board.reportStatusColumnId ?? ""}
          onChange={(e) => setReportStatusColumn(board.id, e.target.value || null)}
          className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
        >
          <option value="">未設定</option>
          {statusColumns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {column && (
        <div className="mb-4 space-y-2">
          <p className="text-xs text-neutral-500">指定每個狀態選項算「已完成」還是「卡住」,其餘算「進行中」</p>
          {options.map((option) => (
            <div key={option.id} className="flex items-center justify-between gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-xs text-white"
                style={{ backgroundColor: option.color }}
              >
                {option.label}
              </span>
              <select
                value={bucketFor(option.id)}
                onChange={(e) => setBucket(option.id, e.target.value as "in_progress" | "stuck" | "done")}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
              >
                <option value="in_progress">進行中</option>
                <option value="stuck">卡住</option>
                <option value="done">已完成</option>
              </select>
            </div>
          ))}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-2 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "儲存中..." : "儲存"}
          </button>
        </div>
      )}
    </Modal>
  );
}
