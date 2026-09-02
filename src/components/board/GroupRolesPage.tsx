"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { GroupRolesModal, type GroupRolesData } from "./GroupRolesModal";
import type { UserOption } from "@/types/board";

type BoardWithGroups = { id: string; name: string; groups: GroupRolesData[] };

export function GroupRolesPage({
  boards,
  users,
}: {
  boards: BoardWithGroups[];
  users: UserOption[];
}) {
  // Track only the ids, not a copy of the group — the group's own data must
  // keep flowing from the `boards` prop (refreshed after every role toggle)
  // rather than a stale snapshot taken when the modal was opened.
  const [target, setTarget] = useState<{ boardId: string; groupId: string } | null>(null);
  const targetGroup = target
    ? boards.find((b) => b.id === target.boardId)?.groups.find((g) => g.id === target.groupId)
    : null;

  return (
    <div className="space-y-6">
      {boards.map((board) => (
        <section key={board.id}>
          <h2 className="mb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-100">{board.name}</h2>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
            {board.groups.map((group) => (
              <div key={group.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-neutral-700 dark:text-neutral-100">{group.name}</span>
                <button
                  type="button"
                  onClick={() => setTarget({ boardId: board.id, groupId: group.id })}
                  className="flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 px-2.5 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <Shield size={13} /> 設定角色
                </button>
              </div>
            ))}
            {board.groups.length === 0 && (
              <p className="px-4 py-3 text-sm text-neutral-400 dark:text-neutral-500">此看板尚無分組</p>
            )}
          </div>
        </section>
      ))}
      {boards.length === 0 && <p className="text-sm text-neutral-400 dark:text-neutral-500">尚無看板</p>}

      {target && targetGroup && (
        <GroupRolesModal
          boardId={target.boardId}
          group={targetGroup}
          users={users}
          open={target !== null}
          onOpenChange={(open) => !open && setTarget(null)}
        />
      )}
    </div>
  );
}
