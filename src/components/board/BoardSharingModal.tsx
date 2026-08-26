"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { UserOption } from "@/types/board";
import type { BoardVisibility } from "@prisma/client";
import {
  setBoardVisibility,
  listBoardMembers,
  addBoardMember,
  removeBoardMember,
} from "@/lib/actions/board";

type BoardMemberRow = Awaited<ReturnType<typeof listBoardMembers>>[number];

export function BoardSharingModal({
  boardId,
  visibility,
  users,
  open,
  onOpenChange,
}: {
  boardId: string;
  visibility: BoardVisibility;
  users: UserOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [members, setMembers] = useState<BoardMemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await listBoardMembers(boardId);
        if (!cancelled) setMembers(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, boardId]);

  async function handleVisibilityChange(next: BoardVisibility) {
    setError(null);
    try {
      await setBoardVisibility(boardId, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "設定失敗");
    }
  }

  async function handleAddMember() {
    if (!addUserId) return;
    setError(null);
    try {
      await addBoardMember(boardId, addUserId);
      setMembers(await listBoardMembers(boardId));
      setAddUserId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增失敗");
    }
  }

  async function handleRemoveMember(userId: string) {
    setError(null);
    try {
      await removeBoardMember(boardId, userId);
      setMembers(await listBoardMembers(boardId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "移除失敗");
    }
  }

  const memberIds = new Set(members.map((m) => m.user.id));
  const nonMembers = users.filter((u) => !u.isResource && !memberIds.has(u.id));

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="看板分享設定">
      {error && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-4 space-y-2">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="radio"
            name="visibility"
            checked={visibility === "PUBLIC"}
            onChange={() => handleVisibilityChange("PUBLIC")}
          />
          公開 — 所有登入使用者可存取
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="radio"
            name="visibility"
            checked={visibility === "RESTRICTED"}
            onChange={() => handleVisibilityChange("RESTRICTED")}
          />
          限制 — 只有擁有者、管理者與下方指定成員可存取
        </label>
      </div>

      {visibility === "RESTRICTED" && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <select
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="">選擇要新增的成員</option>
              {nonMembers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddMember}
              disabled={!addUserId}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              新增
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-neutral-400">載入中...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-neutral-400">目前沒有額外成員(擁有者與管理者一律可存取)</p>
          ) : (
            <ul className="space-y-1">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
                >
                  <span className="text-neutral-800">{m.user.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.user.id)}
                    className="text-neutral-400 hover:text-red-600"
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
