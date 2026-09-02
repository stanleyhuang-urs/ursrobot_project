"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import type { UserOption } from "@/types/board";
import type { GroupDiscipline, GroupRole } from "@prisma/client";
import { setGroupRoleAssignments, setGroupMembers, setGroupResourceMembers } from "@/lib/actions/groupRoles";

/** The slice of Group data this modal actually needs — kept structural
 *  (rather than importing the full GroupData) so both the board page's
 *  BoardWithData groups AND the leaner /group-roles listing query satisfy it. */
export type GroupRolesData = {
  id: string;
  name: string;
  roleAssignments: { role: GroupRole; userId: string }[];
  members: { discipline: GroupDiscipline; userId: string }[];
  resourceMembers: { resourceId: string }[];
};

const ROLE_LABELS: Record<GroupRole, string> = {
  TEAM_LEADER: "Team Leader",
  SW_DM: "SW DM",
  HW_DM: "HW DM",
  ME_DM: "ME DM",
  QA: "QA DM",
  PMM: "PMM",
  PMD: "PMD",
};
const ROLES: GroupRole[] = ["TEAM_LEADER", "SW_DM", "HW_DM", "ME_DM", "QA", "PMM", "PMD"];
const DISCIPLINES: GroupDiscipline[] = ["SW", "HW", "ME", "QA"];

function TogglePillList({
  options,
  selectedIds,
  disabled,
  activeClassName,
  onToggle,
}: {
  options: { id: string; name: string }[];
  selectedIds: Set<string>;
  disabled: boolean;
  activeClassName: string;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const active = selectedIds.has(o.id);
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(o.id)}
            className={`rounded-full px-2 py-0.5 text-[11px] disabled:opacity-50 ${
              active ? activeClassName : "border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600"
            }`}
          >
            {o.name}
          </button>
        );
      })}
    </div>
  );
}

export function GroupRolesModal({
  boardId,
  group,
  users,
  open,
  onOpenChange,
}: {
  boardId: string;
  group: GroupRolesData;
  users: UserOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const realUsers = users.filter((u) => !u.isResource);
  const resources = users.filter((u) => u.isResource);

  async function toggleRole(role: GroupRole, userId: string) {
    const current = group.roleAssignments.filter((a) => a.role === role).map((a) => a.userId);
    const next = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    setPending(`role:${role}`);
    try {
      await setGroupRoleAssignments(boardId, group.id, role, next);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function toggleMember(discipline: GroupDiscipline, userId: string) {
    const current = group.members.filter((m) => m.discipline === discipline).map((m) => m.userId);
    const next = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    setPending(`member:${discipline}`);
    try {
      await setGroupMembers(boardId, group.id, discipline, next);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function toggleResource(resourceId: string) {
    const current = group.resourceMembers.map((m) => m.resourceId);
    const next = current.includes(resourceId)
      ? current.filter((id) => id !== resourceId)
      : [...current, resourceId];
    setPending("resource");
    try {
      await setGroupResourceMembers(boardId, group.id, next);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`${group.name} — 分組角色設定`} size="xl">
      <div className="space-y-5">
        <section>
          <h3 className="mb-1 text-sm font-semibold text-neutral-800 dark:text-neutral-100">角色</h3>
          <p className="mb-2 text-xs text-neutral-400 dark:text-neutral-500">
            Team Leader、PMD 可調整此分組任何項目的時程(拖曳甘特圖、改起訖日)。SW/HW/ME/QA
            DM 可在此分組新增/指派項目、管理各自領域成員的進度,範圍僅限此分組。PMM 目前僅作花名冊,不授予額外權限。
          </p>
          <div className="space-y-2">
            {ROLES.map((role) => (
              <div key={role} className="flex items-start gap-2">
                <span className="w-24 shrink-0 pt-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">{ROLE_LABELS[role]}</span>
                <TogglePillList
                  options={realUsers}
                  selectedIds={new Set(group.roleAssignments.filter((a) => a.role === role).map((a) => a.userId))}
                  disabled={pending === `role:${role}`}
                  activeClassName="bg-neutral-800 text-white"
                  onToggle={(userId) => toggleRole(role, userId)}
                />
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold text-neutral-800 dark:text-neutral-100">實作成員</h3>
          <p className="mb-2 text-xs text-neutral-400 dark:text-neutral-500">SW/HW/ME/QA DM 只能管理各自欄位底下列出的成員。</p>
          <div className="space-y-2">
            {DISCIPLINES.map((discipline) => (
              <div key={discipline} className="flex items-start gap-2">
                <span className="w-24 shrink-0 pt-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">{discipline} member</span>
                <TogglePillList
                  options={realUsers}
                  selectedIds={
                    new Set(group.members.filter((m) => m.discipline === discipline).map((m) => m.userId))
                  }
                  disabled={pending === `member:${discipline}`}
                  activeClassName="bg-blue-600 text-white"
                  onToggle={(userId) => toggleMember(discipline, userId)}
                />
              </div>
            ))}
          </div>
        </section>

        {resources.length > 0 && (
          <section>
            <h3 className="mb-1 text-sm font-semibold text-neutral-800 dark:text-neutral-100">Resource 成員</h3>
            <p className="mb-2 text-xs text-neutral-400 dark:text-neutral-500">花名冊用途,Resource 沒有登入帳號、不會取得任何操作權限。</p>
            <TogglePillList
              options={resources}
              selectedIds={new Set(group.resourceMembers.map((m) => m.resourceId))}
              disabled={pending === "resource"}
              activeClassName="bg-neutral-800 text-white"
              onToggle={toggleResource}
            />
          </section>
        )}
      </div>
    </Modal>
  );
}
