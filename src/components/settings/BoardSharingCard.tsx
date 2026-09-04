"use client";

import { useState } from "react";
import type { BoardVisibility } from "@prisma/client";
import type { UserOption } from "@/types/board";
import { BoardSharingModal } from "@/components/board/BoardSharingModal";

export type SharingBoard = { id: string; name: string; visibility: BoardVisibility };

export function BoardSharingCard({ boards, users }: { boards: SharingBoard[]; users: UserOption[] }) {
  const [openBoardId, setOpenBoardId] = useState<string | null>(null);
  const openBoard = boards.find((b) => b.id === openBoardId) ?? null;

  return (
    <div className="max-w-xl rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3">
      <p className="mb-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">看板分享設定</p>
      <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
        設定每個看板是公開給所有登入使用者,還是限制只有擁有者、管理者與指定成員可存取。
      </p>
      <div className="space-y-2">
        {boards.map((board) => (
          <div
            key={board.id}
            className="flex items-center justify-between rounded-md border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="text-neutral-800 dark:text-neutral-100">{board.name}</span>
              {board.visibility === "RESTRICTED" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  限制存取
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpenBoardId(board.id)}
              className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              分享設定
            </button>
          </div>
        ))}
        {boards.length === 0 && <p className="text-sm text-neutral-400 dark:text-neutral-500">尚無看板</p>}
      </div>
      {openBoard && (
        <BoardSharingModal
          boardId={openBoard.id}
          visibility={openBoard.visibility}
          users={users}
          open={openBoardId !== null}
          onOpenChange={(open) => !open && setOpenBoardId(null)}
        />
      )}
    </div>
  );
}
