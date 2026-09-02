"use client";

import { useState } from "react";
import { upsertCellValue } from "@/lib/actions/cell";
import { normalizeTextInput } from "@/lib/cellValue";

export function TextCell({
  boardId,
  itemId,
  columnId,
  value,
}: {
  boardId: string;
  itemId: string;
  columnId: string;
  value: string;
}) {
  const [text, setText] = useState(value);

  function save() {
    if (text !== value) {
      upsertCellValue(boardId, itemId, columnId, normalizeTextInput(text));
    }
  }

  return (
    <input
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
