"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { upsertCellValue } from "@/lib/actions/cell";
import { getStatusOptions } from "@/types/column";

export function StatusCell({
  boardId,
  itemId,
  columnId,
  value,
  options,
}: {
  boardId: string;
  itemId: string;
  columnId: string;
  value: string | null;
  options: unknown;
}) {
  const statuses = getStatusOptions(options);
  const current = statuses.find((s) => s.id === value);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-7 w-full items-center rounded px-2 text-xs font-medium text-white"
          style={{ backgroundColor: current?.color ?? "#c4c4c4" }}
        >
          {current?.label ?? "設定狀態"}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          className="min-w-[160px] rounded-md border border-neutral-200 bg-white p-1 shadow-md"
        >
          {statuses.map((option) => (
            <DropdownMenu.Item
              key={option.id}
              onSelect={() =>
                upsertCellValue(boardId, itemId, columnId, option.id)
              }
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-neutral-100"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: option.color }}
              />
              {option.label}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-neutral-200" />
          <DropdownMenu.Item
            onSelect={() => upsertCellValue(boardId, itemId, columnId, null)}
            className="cursor-pointer rounded px-2 py-1.5 text-sm text-neutral-500 outline-none hover:bg-neutral-100"
          >
            清除
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
