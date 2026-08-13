"use client";

import { upsertCellValue } from "@/lib/actions/cell";
import { PersonPicker } from "@/components/ui/PersonPicker";
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
    <PersonPicker
      users={users}
      selectedId={value}
      placeholder="未指派"
      unassignedLabel="未指派"
      onSelect={(userId) => upsertCellValue(boardId, itemId, columnId, userId)}
    />
  );
}
