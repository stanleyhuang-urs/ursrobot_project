"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { getStatusOptions } from "@/types/column";
import { setReportStatusColumn, setReportStatusBuckets } from "@/lib/actions/column";
import type { ColumnData } from "@/types/board";

type Bucket = "not_started" | "planned" | "in_progress" | "paused" | "stuck" | "done";

/** Only what this modal actually reads off a board — lets callers (e.g. the
 *  system settings page, listing every board at once) pass a narrow query
 *  result instead of a full BoardWithData. */
export type ReportSettingsBoard = {
  id: string;
  columns: ColumnData[];
  reportStatusColumnId: string | null;
  reportNotStartedOptionIds: string[];
  reportPlannedOptionIds: string[];
  reportPausedOptionIds: string[];
  reportStuckOptionIds: string[];
  reportDoneOptionIds: string[];
};

const BUCKET_LABELS: Record<Bucket, string> = {
  not_started: "尚未處理",
  planned: "計畫中",
  in_progress: "進行中",
  paused: "暫停",
  stuck: "卡住",
  done: "已完成",
};

export function ReportSettingsModal({
  board,
  open,
  onOpenChange,
}: {
  board: ReportSettingsBoard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const statusColumns = board.columns.filter((c) => c.type === "STATUS");
  const [notStartedIds, setNotStartedIds] = useState<Set<string>>(new Set(board.reportNotStartedOptionIds));
  const [plannedIds, setPlannedIds] = useState<Set<string>>(new Set(board.reportPlannedOptionIds));
  const [pausedIds, setPausedIds] = useState<Set<string>>(new Set(board.reportPausedOptionIds));
  const [stuckIds, setStuckIds] = useState<Set<string>>(new Set(board.reportStuckOptionIds));
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set(board.reportDoneOptionIds));
  const [saving, setSaving] = useState(false);

  const column = board.columns.find((c) => c.id === board.reportStatusColumnId);
  const options = column ? getStatusOptions(column.options) : [];

  const bucketSets: Record<Exclude<Bucket, "in_progress">, Set<string>> = {
    not_started: notStartedIds,
    planned: plannedIds,
    paused: pausedIds,
    stuck: stuckIds,
    done: doneIds,
  };
  const bucketSetters: Record<Exclude<Bucket, "in_progress">, (next: Set<string>) => void> = {
    not_started: setNotStartedIds,
    planned: setPlannedIds,
    paused: setPausedIds,
    stuck: setStuckIds,
    done: setDoneIds,
  };

  function bucketFor(optionId: string): Bucket {
    for (const key of Object.keys(bucketSets) as (keyof typeof bucketSets)[]) {
      if (bucketSets[key].has(optionId)) return key;
    }
    return "in_progress";
  }

  function setBucket(optionId: string, bucket: Bucket) {
    for (const key of Object.keys(bucketSets) as (keyof typeof bucketSets)[]) {
      const current = bucketSets[key];
      if (key === bucket) {
        if (!current.has(optionId)) {
          const next = new Set(current);
          next.add(optionId);
          bucketSetters[key](next);
        }
      } else if (current.has(optionId)) {
        const next = new Set(current);
        next.delete(optionId);
        bucketSetters[key](next);
      }
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setReportStatusBuckets(board.id, {
        notStartedOptionIds: [...notStartedIds],
        plannedOptionIds: [...plannedIds],
        pausedOptionIds: [...pausedIds],
        stuckOptionIds: [...stuckIds],
        doneOptionIds: [...doneIds],
      });
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
          <p className="text-xs text-neutral-500">指定每個狀態選項屬於哪個分類,未指定的算「進行中」</p>
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
                onChange={(e) => setBucket(option.id, e.target.value as Bucket)}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
              >
                {(Object.keys(BUCKET_LABELS) as Bucket[]).map((b) => (
                  <option key={b} value={b}>
                    {BUCKET_LABELS[b]}
                  </option>
                ))}
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
