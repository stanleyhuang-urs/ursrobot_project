"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { createColumn } from "@/lib/actions/column";
import type { ColumnType } from "@/types/column";

const TYPE_LABELS: Record<ColumnType, string> = {
  TEXT: "文字",
  STATUS: "狀態",
  PERSON: "人員",
  DATE: "日期",
  NUMBER: "數字",
};

export function AddColumnDialog({
  boardId,
  open,
  onOpenChange,
}: {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ColumnType>("TEXT");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleCreate() {
    if (!name.trim()) return;
    setPending(true);
    await createColumn(boardId, name.trim(), type);
    setPending(false);
    setName("");
    setType("TEXT");
    onOpenChange(false);
    // revalidatePath alone doesn't reliably refresh an already-open client
    // on a large board — force it so the new column actually shows up.
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="新增欄位">
      <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-100">
        欄位名稱
      </label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mb-4 w-full rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
      />

      <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-100">
        欄位類型
      </label>
      <select
        value={type}
        onChange={(e) => setType(e.target.value as ColumnType)}
        className="mb-4 w-full rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
      >
        {(Object.keys(TYPE_LABELS) as ColumnType[]).map((t) => (
          <option key={t} value={t}>
            {TYPE_LABELS[t]}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={pending}
        onClick={handleCreate}
        className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        新增
      </button>
    </Modal>
  );
}
