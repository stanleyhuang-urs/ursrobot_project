"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { ReportSettingsModal, type ReportSettingsBoard } from "../board/ReportSettingsModal";

export type ReportSettingsBoardWithName = ReportSettingsBoard & { name: string };

function BoardReportSettingsRow({ board }: { board: ReportSettingsBoardWithName }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center justify-between rounded-md border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm">
      <span className="text-neutral-700 dark:text-neutral-100">{board.name}</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        <Settings size={13} /> 報表設定
      </button>
      <ReportSettingsModal board={board} open={open} onOpenChange={setOpen} />
    </div>
  );
}

export function ReportSettingsCard({ boards }: { boards: ReportSettingsBoardWithName[] }) {
  return (
    <div className="max-w-xl rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3">
      <p className="mb-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">報表設定</p>
      <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
        設定每個看板的報表用哪個狀態欄位統計、每個狀態屬於哪個分類。
      </p>
      <div className="space-y-2">
        {boards.map((b) => (
          <BoardReportSettingsRow key={b.id} board={b} />
        ))}
        {boards.length === 0 && <p className="text-sm text-neutral-400 dark:text-neutral-500">尚無看板</p>}
      </div>
    </div>
  );
}
