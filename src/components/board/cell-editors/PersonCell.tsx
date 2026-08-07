"use client";

import { upsertCellValue } from "@/lib/actions/cell";
import type { UserOption } from "@/types/board";

export function PersonCell({
  boardId,
  itemId,
  columnId,
  value,
  users,
}: {
  boardId: string;
  itemId: string;
  columnId: string;
  value: string | null;
  users: UserOption[];
}) {
  return (
    <select
      defaultValue={value ?? ""}
      onChange={(e) => {
        upsertCellValue(boardId, itemId, columnId, e.target.value || null);
      }}
      className="w-full rounded bg-transparent px-2 py-1 text-sm outline-none hover:bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-blue-400"
    >
      <option value="">未指派</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}
