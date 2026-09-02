"use client";

import { upsertCellValue } from "@/lib/actions/cell";
import { computeWbsCodes } from "@/lib/wbs";
import type { ItemData } from "@/types/board";

/** Pred is stored as a plain WBS-code string, but typing one by hand means
 *  knowing the target item's code in advance — this lists every other item
 *  in the same group by name instead, same as AssignmentModal's Pred picker. */
export function PredCell({
  boardId,
  itemId,
  columnId,
  value,
  groupItems,
}: {
  boardId: string;
  itemId: string;
  columnId: string;
  value: string | null;
  groupItems: ItemData[];
}) {
  const codes = computeWbsCodes(groupItems);
  const options = groupItems
    .filter((i) => i.id !== itemId)
    .map((i) => ({ code: codes.get(i.id) ?? "", name: i.name }))
    .filter((o) => o.code)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return (
    <select
      value={value ?? ""}
      onChange={(e) => upsertCellValue(boardId, itemId, columnId, e.target.value || null)}
      className="w-full rounded border-none bg-transparent px-2 py-1 text-sm outline-none hover:bg-neutral-50 dark:hover:bg-neutral-800 focus:bg-white dark:focus:bg-neutral-900 focus:ring-1 focus:ring-blue-400"
    >
      <option value="">未設定</option>
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.code} {o.name}
        </option>
      ))}
    </select>
  );
}
