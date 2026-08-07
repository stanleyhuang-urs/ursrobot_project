"use client";

import { upsertCellValue } from "@/lib/actions/cell";

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
  return (
    <input
      type="date"
      defaultValue={value ?? ""}
      onChange={(e) => {
        upsertCellValue(boardId, itemId, columnId, e.target.value || null);
      }}
      className="w-full rounded px-2 py-1 text-sm outline-none hover:bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-blue-400"
    />
  );
}
