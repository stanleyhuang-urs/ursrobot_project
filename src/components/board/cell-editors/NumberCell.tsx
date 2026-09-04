"use client";

import { useState } from "react";
import { upsertCellValue } from "@/lib/actions/cell";
import { parseNumberInput } from "@/lib/cellValue";
import { useCellSave } from "./useCellSave";

export function NumberCell({
  boardId,
  itemId,
  columnId,
  value,
  percent = false,
}: {
  boardId: string;
  itemId: string;
  columnId: string;
  value: number | null;
  percent?: boolean;
}) {
  const displayValue = percent && value !== null ? Math.round(value * 100) : value;
  const [text, setText] = useState(displayValue === null ? "" : String(displayValue));
  const runSave = useCellSave();

  function save() {
    const entered = parseNumberInput(text);
    const normalized = percent && entered !== null ? entered / 100 : entered;
    if (normalized !== value) {
      runSave(() => upsertCellValue(boardId, itemId, columnId, normalized));
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
      className="w-full rounded px-2 py-1 text-sm outline-none hover:bg-neutral-50 dark:hover:bg-neutral-800 focus:bg-white dark:focus:bg-neutral-900 focus:ring-1 focus:ring-blue-400"
    />
  );
}
