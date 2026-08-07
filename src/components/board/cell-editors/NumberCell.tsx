"use client";

import { useState } from "react";
import { upsertCellValue } from "@/lib/actions/cell";
import { parseNumberInput } from "@/lib/cellValue";

export function NumberCell({
  boardId,
  itemId,
  columnId,
  value,
}: {
  boardId: string;
  itemId: string;
  columnId: string;
  value: number | null;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));

  function save() {
    const normalized = parseNumberInput(text);
    if (normalized !== value) {
      upsertCellValue(boardId, itemId, columnId, normalized);
    }
  }

  return (
    <input
      type="number"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
      }}
      className="w-full rounded px-2 py-1 text-sm outline-none hover:bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-blue-400"
    />
  );
}
