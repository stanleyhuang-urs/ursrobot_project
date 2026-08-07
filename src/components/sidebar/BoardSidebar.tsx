"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LayoutGrid, Plus, Pencil, Trash2, Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { RowMenu, RowMenuItem } from "@/components/ui/RowMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { createBoard, renameBoard, deleteBoard } from "@/lib/actions/board";
import { logout } from "@/lib/actions/auth";

type Board = { id: string; name: string };

export function BoardSidebar({
  boards,
  userName,
  userRole,
}: {
  boards: Board[];
  userName: string;
  userRole: "ADMIN" | "MEMBER";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const [renameTarget, setRenameTarget] = useState<Board | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function handleCreate() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const board = await createBoard(newName.trim());
      setCreateOpen(false);
      setNewName("");
      router.push(`/boards/${board.id}`);
    });
  }

  function handleRename() {
    if (!renameTarget || !renameValue.trim()) return;
    startTransition(async () => {
      await renameBoard(renameTarget.id, renameValue.trim());
      setRenameTarget(null);
    });
  }

  function handleDelete(board: Board) {
    if (!confirm(`確定要刪除看板「${board.name}」嗎?此操作無法復原。`)) return;
    startTransition(async () => {
      await deleteBoard(board.id);
      if (pathname === `/boards/${board.id}`) {
        router.push("/boards");
      }
    });
  }

  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="flex items-center justify-between px-4 py-4">
        <span className="text-sm font-semibold text-neutral-900">看板</span>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          aria-label="新增看板"
        >
          <Plus size={16} />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-auto px-2">
        <Link
          href="/dashboard"
          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
            pathname === "/dashboard"
              ? "bg-blue-50 text-blue-700"
              : "text-neutral-700 hover:bg-neutral-100"
          }`}
        >
          <LayoutDashboard size={14} className="shrink-0" />
          儀表板
        </Link>
        {userRole === "ADMIN" && (
          <Link
            href="/users"
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
              pathname === "/users"
                ? "bg-blue-50 text-blue-700"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            <Users size={14} className="shrink-0" />
            使用者管理
          </Link>
        )}
        {boards.map((board) => {
          const active = pathname === `/boards/${board.id}`;
          return (
            <div
              key={board.id}
              className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              <Link
                href={`/boards/${board.id}`}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <LayoutGrid size={14} className="shrink-0" />
                <span className="truncate">{board.name}</span>
              </Link>
              <RowMenu>
                <RowMenuItem
                  onSelect={() => {
                    setRenameTarget(board);
                    setRenameValue(board.name);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Pencil size={14} /> 重新命名
                  </span>
                </RowMenuItem>
                <RowMenuItem danger onSelect={() => handleDelete(board)}>
                  <span className="flex items-center gap-2">
                    <Trash2 size={14} /> 刪除
                  </span>
                </RowMenuItem>
              </RowMenu>
            </div>
          );
        })}
        {boards.length === 0 && (
          <p className="px-2 py-2 text-xs text-neutral-400">尚無看板</p>
        )}
      </nav>

      <div className="border-t border-neutral-200 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="truncate text-xs text-neutral-500">{userName}</p>
          <NotificationBell />
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
          >
            登出
          </button>
        </form>
      </div>

      <Modal open={createOpen} onOpenChange={setCreateOpen} title="新增看板">
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="看板名稱"
          className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={handleCreate}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          建立
        </button>
      </Modal>

      <Modal
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        title="重新命名看板"
      >
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRename()}
          className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={handleRename}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          儲存
        </button>
      </Modal>
    </div>
  );
}
