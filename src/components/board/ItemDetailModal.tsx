"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { ColumnData, ItemData, UserOption } from "@/types/board";
import { UpdatesTab } from "./item-detail/UpdatesTab";
import { FilesTab } from "./item-detail/FilesTab";
import { ActivityLogTab } from "./item-detail/ActivityLogTab";
import { ItemCardTab } from "./item-detail/ItemCardTab";
import { ChecklistTab } from "./item-detail/ChecklistTab";

const TABS = [
  { id: "updates", label: "更新" },
  { id: "files", label: "檔案" },
  { id: "activity", label: "活動紀錄" },
  { id: "card", label: "項目卡片" },
  { id: "checklist", label: "待辦事項" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ItemDetailModal({
  boardId,
  item,
  columns,
  users,
  open,
  onOpenChange,
}: {
  boardId: string;
  item: ItemData | null;
  columns: ColumnData[];
  users: UserOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<TabId>("updates");

  if (!item) return null;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={item.name} size="xl">
      <div className="mb-4 flex gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm ${
              tab === t.id
                ? "border-b-2 border-blue-600 font-medium text-blue-600"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "updates" && <UpdatesTab boardId={boardId} itemId={item.id} />}
      {tab === "files" && <FilesTab boardId={boardId} itemId={item.id} />}
      {tab === "activity" && <ActivityLogTab itemId={item.id} />}
      {tab === "card" && <ItemCardTab item={item} columns={columns} users={users} />}
      {tab === "checklist" && <ChecklistTab boardId={boardId} itemId={item.id} />}
    </Modal>
  );
}
