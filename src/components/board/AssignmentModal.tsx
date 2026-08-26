"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Trash2 } from "lucide-react";
import type { ItemData, UserOption } from "@/types/board";
import type { UserRole } from "@prisma/client";
import { listAssignments, upsertAssignment, removeAssignment } from "@/lib/actions/assignment";
import { Avatar } from "@/components/ui/Avatar";
import { PersonPicker } from "@/components/ui/PersonPicker";

export function AssignmentModal({
  boardId,
  item,
  users,
  currentUserId,
  userRole,
  open,
  onOpenChange,
}: {
  boardId: string;
  item: ItemData | null;
  users: UserOption[];
  currentUserId: string;
  userRole: UserRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
    <Modal open={open} onOpenChange={onOpenChange} title={`${item.name} — 人員分配`}>
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
    </Modal>
  );
}
