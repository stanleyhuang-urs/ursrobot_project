"use client";

import { upsertCellValue } from "@/lib/actions/cell";
import { useCellSave } from "./useCellSave";

export function DateCell({
  boardId,
  itemId,
  columnId,
  value,
}: {
  boardId: string;
  itemId: string;
  columnId: string;
  value: string | null;
}) {
  const save = useCellSave();
  return (
    <input
      type="date"
      defaultValue={value ?? ""}
      onChange={(e) => {
        save(() => upsertCellValue(boardId, itemId, columnId, e.target.value || null));
      }}
      className="w-full rounded px-2 py-1 text-sm outline-none hover:bg-neutral-50 dark:hover:bg-neutral-800 focus:bg-white dark:focus:bg-neutral-900 focus:ring-1 focus:ring-blue-400"
    />
  );
}
