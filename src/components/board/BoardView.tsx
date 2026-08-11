"use client";

import { useState } from "react";
import { Table2, LayoutGrid, Upload, GanttChartSquare, Users2, Zap, Share2 } from "lucide-react";
import type { BoardWithData, UserOption } from "@/types/board";
import type { UserRole } from "@prisma/client";
import { canManageBoard, canManageStructure } from "@/lib/permissions";
import { BoardTable } from "./BoardTable";
import { BoardKanban } from "./BoardKanban";
import { BoardGantt } from "./BoardGantt";
import { AddColumnDialog } from "./AddColumnDialog";
import { ImportWizard } from "./ImportWizard";
import { ResourceMappingModal } from "./ResourceMappingModal";
import { AutomationRulesModal } from "./AutomationRulesModal";
import { BoardSharingModal } from "./BoardSharingModal";

export function BoardView({
  board,
  users,
  userRole,
  currentUserId,
}: {
  board: BoardWithData;
  users: UserOption[];
  userRole: UserRole;
  currentUserId: string;
}) {
  const [view, setView] = useState<"table" | "kanban" | "gantt">("table");
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [resourceMappingOpen, setResourceMappingOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);
  const canManageSharing = canManageBoard(userRole) || board.ownerId === currentUserId;

  const statusColumns = board.columns.filter((c) => c.type === "STATUS");
  const [kanbanColumnId, setKanbanColumnId] = useState(
    statusColumns[0]?.id ?? ""
  );
  const progressColumn = board.columns.find(
    (c) => c.id === board.progressColumnId
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-neutral-900">{board.name}</h1>
            {board.visibility === "RESTRICTED" && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                限制存取
              </span>
            )}
          </div>
          {progressColumn && (
            <p className="text-xs text-neutral-400">
              進度欄位:{progressColumn.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canManageBoard(userRole) && (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              <Upload size={14} /> 匯入
            </button>
          )}
          {canManageBoard(userRole) && (
            <button
              type="button"
              onClick={() => setResourceMappingOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              <Users2 size={14} /> Resource 對應
            </button>
          )}
          {canManageStructure(userRole) && (
            <button
              type="button"
              onClick={() => setAutomationOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              <Zap size={14} /> 自動化
            </button>
          )}
          {canManageSharing && (
            <button
              type="button"
              onClick={() => setSharingOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              <Share2 size={14} /> 分享設定
            </button>
          )}
          <div className="flex overflow-hidden rounded-md border border-neutral-200">
            <button
              type="button"
              onClick={() => setView("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${
                view === "table"
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              <Table2 size={14} /> 表格
            </button>
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${
                view === "kanban"
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              <LayoutGrid size={14} /> 看板
            </button>
            <button
              type="button"
              onClick={() => setView("gantt")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${
                view === "gantt"
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              <GanttChartSquare size={14} /> 甘特圖
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {view === "table" && (
          <BoardTable
            board={board}
            users={users}
            userRole={userRole}
            currentUserId={currentUserId}
            onAddColumn={() => setAddColumnOpen(true)}
          />
        )}
        {view === "kanban" && (
          <BoardKanban
            board={board}
            statusColumns={statusColumns}
            columnId={kanbanColumnId || statusColumns[0]?.id || ""}
            onChangeColumn={setKanbanColumnId}
          />
        )}
        {view === "gantt" && (
          <BoardGantt
            board={board}
            users={users}
            userRole={userRole}
            currentUserId={currentUserId}
          />
        )}
      </div>

      {canManageStructure(userRole) && (
        <AddColumnDialog
          boardId={board.id}
          open={addColumnOpen}
          onOpenChange={setAddColumnOpen}
        />
      )}

      {canManageBoard(userRole) && (
        <ImportWizard
          boardId={board.id}
          columns={board.columns}
          groups={board.groups}
          open={importOpen}
          onOpenChange={setImportOpen}
        />
      )}

      {canManageBoard(userRole) && (
        <ResourceMappingModal
          boardId={board.id}
          columns={board.columns}
          users={users}
          open={resourceMappingOpen}
          onOpenChange={setResourceMappingOpen}
        />
      )}

      {canManageStructure(userRole) && (
        <AutomationRulesModal
          boardId={board.id}
          columns={board.columns}
          groups={board.groups}
          users={users}
          open={automationOpen}
          onOpenChange={setAutomationOpen}
        />
      )}

      {canManageSharing && (
        <BoardSharingModal
          boardId={board.id}
          visibility={board.visibility}
          users={users}
          open={sharingOpen}
          onOpenChange={setSharingOpen}
        />
      )}
    </div>
  );
}
