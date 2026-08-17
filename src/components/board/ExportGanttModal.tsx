"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { exportGanttDay } from "@/lib/actions/export";
import type { GroupData } from "@/types/board";

export function ExportGanttModal({
  boardId,
  groups,
  open,
  onOpenChange,
}: {
  boardId: string;
  groups: GroupData[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (!groupId) return;
    setSubmitting(true);
    setError(null);
    try {
      const { filename, base64 } = await exportGanttDay(boardId, groupId);
      const byteChars = atob(base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "匯出失敗");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="匯出 Google Sheet(Gantt)">
      {error && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <p className="text-sm text-neutral-500">
          匯出選定分組的工作事項為 .xlsx,欄位對應「Gantt (Day)」分頁格式(第 6
          列標題、第 7 列起資料),可直接複製貼上到既有 Google Sheet 的 Gantt
          (Day) 分頁,Week/Month 分頁與甘特條會自動同步更新。
        </p>
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={submitting || !groupId}
          onClick={handleExport}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "匯出中..." : "匯出"}
        </button>
      </div>
    </Modal>
  );
}
