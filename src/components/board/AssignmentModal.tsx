"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Trash2 } from "lucide-react";
import type { ColumnData, ItemData, UserOption } from "@/types/board";
import type { UserRole } from "@prisma/client";
import { listAssignments, upsertAssignment, removeAssignment } from "@/lib/actions/assignment";
import { upsertCellValue } from "@/lib/actions/cell";
import { Avatar } from "@/components/ui/Avatar";
import { PersonPicker } from "@/components/ui/PersonPicker";
import { CellEditor } from "./cell-editors/CellEditor";
import { computeWbsCodes } from "@/lib/wbs";

export function AssignmentModal({
  boardId,
  item,
  users,
  currentUserId,
  userRole,
  open,
  onOpenChange,
  columns,
  predColumnId,
  linkColumnId,
  lagColumnId,
  durationColumnId,
  canEditSchedule = false,
  groupItems,
}: {
  boardId: string;
  item: ItemData | null;
  users: UserOption[];
  currentUserId: string;
  userRole: UserRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pred/Link/Lag/Duration columns, shown as an extra "時程設定" section
   *  when provided — used by the Gantt view so clicking a bar can edit
   *  these alongside people, instead of needing the full item-detail card.
   *  Gated by canEditSchedule (the same permission that let the modal open
   *  at all), not a separate per-field check. */
  columns?: ColumnData[];
  predColumnId?: string | null;
  linkColumnId?: string | null;
  lagColumnId?: string | null;
  /** The board's actual manual-duration input — manualDurationColumnId
   *  when the board has one configured, else the classic ganttDurationColumnId
   *  ("Days"). Whichever one the item's Start/Finish are actually derived
   *  from, so setting it here has the same effect as editing it directly. */
  durationColumnId?: string | null;
  canEditSchedule?: boolean;
  /** Every item in the same group as `item` — used to build the Pred
   *  dropdown (item name -> its WBS code, since that's what's actually
   *  stored) instead of making the user type a WBS code by hand. */
  groupItems?: ItemData[];
}) {
  const [assignments, setAssignments] = useState<
    Awaited<ReturnType<typeof listAssignments>>
  >([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [pct, setPct] = useState(10);

  useEffect(() => {
    if (!open || !item) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await listAssignments(item.id);
        if (!cancelled) setAssignments(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, item]);

  if (!item) return null;

  const scheduleColumns = [predColumnId, linkColumnId, lagColumnId, durationColumnId]
    .map((id) => columns?.find((c) => c.id === id))
    .filter((c): c is ColumnData => !!c);

  // Item name -> its WBS code, so Pred can be picked from a list instead of
  // typed by hand — codes are group-scoped (same rule as the lock check and
  // the table's own WBS badges), so this only ever offers items from the
  // same group `item` is in.
  const predOptions = groupItems
    ? (() => {
        const codes = computeWbsCodes(groupItems);
        return groupItems
          .filter((i) => i.id !== item.id)
          .map((i) => ({ code: codes.get(i.id) ?? "", name: i.name }))
          .filter((o) => o.code)
          .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      })()
    : [];

  // Gantt Assignments reference a real User row (foreign key) — Resources
  // (tools/vendors) can be a PERSON-column 負責人 but not a %-allocation here.
  const realUsers = users.filter((u) => !u.isResource);
  const assignableUsers =
    userRole === "SUPERVISOR"
      ? realUsers.filter((u) => u.supervisorId === currentUserId)
      : realUsers;

  const assignedUserIds = new Set(assignments.map((a) => a.userId));
  const availableUsers = assignableUsers.filter((u) => !assignedUserIds.has(u.id));

  async function refresh() {
    if (!item) return;
    setAssignments(await listAssignments(item.id));
  }

  async function handleAdd() {
    if (!item || !selectedUserId) return;
    await upsertAssignment(boardId, item.id, selectedUserId, pct);
    setSelectedUserId("");
    setPct(10);
    await refresh();
  }

  async function handleRemove(userId: string) {
    if (!item) return;
    await removeAssignment(boardId, item.id, userId);
    await refresh();
  }

  async function handleUpdatePct(userId: string, nextPct: number) {
    if (!item) return;
    await upsertAssignment(boardId, item.id, userId, nextPct);
    await refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`${item.name} — 人員分配`} size="lg">
      <div className="mb-4 space-y-2">
        {loading && <p className="text-sm text-neutral-400">載入中...</p>}
        {!loading && assignments.length === 0 && (
          <p className="text-sm text-neutral-400">尚未指派人員</p>
        )}
        {assignments.map((a) => (
          <div
            key={a.userId}
            className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2"
          >
            <span className="flex min-w-0 items-center gap-2 text-sm text-neutral-800">
              <Avatar name={a.user.name} avatarUrl={a.user.avatarUrl} size={22} />
              <span className="truncate">{a.user.name}</span>
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={100}
                step={5}
                value={a.allocationPct}
                onChange={(e) => handleUpdatePct(a.userId, Number(e.target.value))}
                className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-right text-sm outline-none focus:border-blue-500"
              />
              <span className="text-sm text-neutral-500">%</span>
              <button
                type="button"
                onClick={() => handleRemove(a.userId)}
                className="text-neutral-400 hover:text-red-600"
                aria-label="移除"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {availableUsers.length > 0 ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border border-neutral-300">
            <PersonPicker
              users={availableUsers}
              selectedId={selectedUserId || null}
              onSelect={(userId) => setSelectedUserId(userId ?? "")}
            />
          </div>
          <input
            type="number"
            min={5}
            max={100}
            step={5}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="w-20 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
          />
          <span className="text-sm text-neutral-500">%</span>
          <button
            type="button"
            disabled={!selectedUserId}
            onClick={handleAdd}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            新增
          </button>
        </div>
      ) : (
        userRole === "SUPERVISOR" && (
          <p className="text-sm text-neutral-400">你的團隊目前沒有可指派的成員。</p>
        )
      )}

      {scheduleColumns.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
          <h3 className="text-xs font-semibold text-neutral-500">時程設定</h3>
          {scheduleColumns.map((col) => {
            const rawValue = item.cellValues.find((cv) => cv.columnId === col.id)?.value as
              | string
              | number
              | null
              | undefined;
            const isPredWithOptions = col.id === predColumnId && groupItems;
            return (
              <div key={col.id} className="flex items-center justify-between gap-3">
                <span className="shrink-0 text-xs text-neutral-500">{col.name}</span>
                <div className="w-56">
                  {isPredWithOptions ? (
                    <select
                      value={typeof rawValue === "string" ? rawValue : ""}
                      disabled={!canEditSchedule}
                      onChange={(e) =>
                        upsertCellValue(boardId, item.id, col.id, e.target.value || null)
                      }
                      className="w-full rounded border-none bg-transparent px-2 py-1 text-sm outline-none hover:bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                    >
                      <option value="">未設定</option>
                      {predOptions.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.code} {o.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <CellEditor
                      boardId={boardId}
                      itemId={item.id}
                      column={col}
                      value={rawValue ?? null}
                      users={users}
                      canEdit={canEditSchedule}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
