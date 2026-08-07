"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import type { BoardWithData, ColumnData, ItemData } from "@/types/board";
import { getStatusOptions } from "@/types/column";
import { KanbanLane } from "./KanbanLane";
import { upsertCellValue } from "@/lib/actions/cell";

const UNSET_LANE = "unset";

export function BoardKanban({
  board,
  statusColumns,
  columnId,
  onChangeColumn,
}: {
  board: BoardWithData;
  statusColumns: ColumnData[];
  columnId: string;
  onChangeColumn: (id: string) => void;
}) {
  const column = statusColumns.find((c) => c.id === columnId) ?? statusColumns[0];
  const statuses = useMemo(
    () => (column ? getStatusOptions(column.options) : []),
    [column]
  );

  const [items, setItems] = useState<ItemData[]>(board.items);
  const [syncedBoardItems, setSyncedBoardItems] = useState(board.items);
  if (board.items !== syncedBoardItems) {
    setSyncedBoardItems(board.items);
    setItems(board.items);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function laneIdForItem(item: ItemData): string {
    if (!column) return UNSET_LANE;
    const cv = item.cellValues.find((c) => c.columnId === column.id);
    const val = cv?.value;
    if (typeof val === "string" && statuses.some((s) => s.id === val)) return val;
    return UNSET_LANE;
  }

  const lanes = useMemo(() => {
    const map = new Map<string, ItemData[]>();
    map.set(UNSET_LANE, []);
    for (const s of statuses) map.set(s.id, []);
    for (const item of items) {
      const laneId = laneIdForItem(item);
      const list = map.get(laneId) ?? [];
      list.push(item);
      map.set(laneId, list);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, column, statuses]);

  function findLaneOfCard(cardId: string): string | undefined {
    for (const [laneId, laneItems] of lanes) {
      if (laneItems.some((i) => i.id === cardId)) return laneId;
    }
    return undefined;
  }

  function resolveOverLane(overId: string): string | undefined {
    if (overId === UNSET_LANE || statuses.some((s) => s.id === overId)) {
      return overId;
    }
    return findLaneOfCard(overId);
  }

  function moveItemLocally(activeId: string, targetLane: string) {
    if (!column) return;
    const newValue = targetLane === UNSET_LANE ? null : targetLane;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== activeId) return item;
        const existingIndex = item.cellValues.findIndex(
          (cv) => cv.columnId === column.id
        );
        const newCellValues =
          existingIndex >= 0
            ? item.cellValues.map((cv, idx) =>
                idx === existingIndex ? { ...cv, value: newValue } : cv
              )
            : [
                ...item.cellValues,
                {
                  id: `local-${item.id}-${column.id}`,
                  itemId: item.id,
                  columnId: column.id,
                  value: newValue,
                },
              ];
        return { ...item, cellValues: newCellValues };
      })
    );
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !column) return;
    const activeId = String(active.id);
    const overLane = resolveOverLane(String(over.id));
    const activeLane = findLaneOfCard(activeId);
    if (!overLane || !activeLane || overLane === activeLane) return;
    moveItemLocally(activeId, overLane);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !column) return;
    const activeId = String(active.id);
    const overLane = resolveOverLane(String(over.id));
    if (!overLane) return;

    const finalValue = overLane === UNSET_LANE ? null : overLane;
    upsertCellValue(board.id, activeId, column.id, finalValue);
  }

  if (!column) {
    return (
      <p className="text-sm text-neutral-500">
        看板檢視需要至少一個「狀態」欄位,請先新增一個狀態欄位。
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-neutral-500">依欄位分組:</span>
        <select
          value={column.id}
          onChange={(e) => onChangeColumn(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
        >
          {statusColumns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <DndContext
        id="board-kanban-dnd"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          <KanbanLane
            laneId={UNSET_LANE}
            label="未設定"
            color="#9aa0a6"
            items={lanes.get(UNSET_LANE) ?? []}
          />
          {statuses.map((s) => (
            <KanbanLane
              key={s.id}
              laneId={s.id}
              label={s.label}
              color={s.color}
              items={lanes.get(s.id) ?? []}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
