"use client";

import { useState } from "react";
import { Table2, LayoutGrid, Upload, Download, GanttChartSquare, Users2, Zap, BarChart3 } from "lucide-react";
import type { BoardWithData, UserOption } from "@/types/board";
import type { Holiday, UserRole } from "@prisma/client";
import { canManageBoard, canManageStructure } from "@/lib/permissions";
import { BoardTable } from "./BoardTable";
import { BoardKanban } from "./BoardKanban";
import { BoardGantt } from "./BoardGantt";
import { BoardReport } from "./BoardReport";
import { AddColumnDialog } from "./AddColumnDialog";
import { ImportWizard } from "./ImportWizard";
import { ResourceMappingModal } from "./ResourceMappingModal";
import { AutomationRulesModal } from "./AutomationRulesModal";
import { RowMenu, RowMenuItem } from "@/components/ui/RowMenu";
import { ExportGanttModal } from "./ExportGanttModal";

export function BoardView({
  board,
  users,
  userRole,
  currentUserId,
  highlightItemId,
  holidays,
}: {
  board: BoardWithData;
  users: UserOption[];
  userRole: UserRole;
  currentUserId: string;
  highlightItemId?: string | null;
  holidays: Holiday[];
}) {
  const [view, setView] = useState<"table" | "kanban" | "gantt" | "report">("table");
  const [ganttNavigateHighlight, setGanttNavigateHighlight] = useState<string | null>(null);
  function goToItemInTable(itemId: string) {
    setGanttNavigateHighlight(itemId);
    setView("table");
  }
  // A ?highlight= link (notifications, overdue tasks, workload detail) can
  // be clicked from any tab — jump to the table view so BoardTable actually
  // mounts and opens the item's card, instead of silently updating the URL
  // behind whichever tab (e.g. 報表) happens to be showing.
  const [prevHighlightItemId, setPrevHighlightItemId] = useState(highlightItemId);
  if (highlightItemId !== prevHighlightItemId) {
    setPrevHighlightItemId(highlightItemId);
    if (highlightItemId) setView("table");
  }
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [resourceMappingOpen, setResourceMappingOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const statusColumns = board.columns.filter((c) => c.type === "STATUS");
  const [kanbanColumnId, setKanbanColumnId] = useState(
    statusColumns[0]?.id ?? ""
  );
  const progressColumn = board.columns.find(
    (c) => c.id === board.progressColumnId
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{board.name}</h1>
            {board.visibility === "RESTRICTED" && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                限制存取
              </span>
            )}
          </div>
          {progressColumn && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              進度欄位:{progressColumn.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 匯入/匯出/Resource 對應/自動化 are occasional board-admin tasks,
              so they live behind one "…" instead of taking four slots away
              from the views the user switches between all day. */}
          {(canManageBoard(userRole) || canManageStructure(userRole)) && (
            <RowMenu triggerClassName="flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800">
              {canManageBoard(userRole) && (
                <RowMenuItem onSelect={() => setImportOpen(true)}>
                  <span className="flex items-center gap-2">
                    <Download size={14} /> 匯入
                  </span>
                </RowMenuItem>
              )}
              {canManageBoard(userRole) && (
                <RowMenuItem onSelect={() => setExportOpen(true)}>
                  <span className="flex items-center gap-2">
                    <Upload size={14} /> 匯出
                  </span>
                </RowMenuItem>
              )}
              {canManageBoard(userRole) && (
                <RowMenuItem onSelect={() => setResourceMappingOpen(true)}>
                  <span className="flex items-center gap-2">
                    <Users2 size={14} /> Resource 對應
                  </span>
                </RowMenuItem>
              )}
              {canManageStructure(userRole) && (
                <RowMenuItem onSelect={() => setAutomationOpen(true)}>
                  <span className="flex items-center gap-2">
                    <Zap size={14} /> 自動化
                  </span>
                </RowMenuItem>
              )}
            </RowMenu>
          )}
          <div className="flex overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => setView("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${
                view === "table"
                  ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                  : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              <Table2 size={14} /> 表格
            </button>
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${
                view === "kanban"
                  ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                  : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              <LayoutGrid size={14} /> 看板
            </button>
            <button
              type="button"
              onClick={() => setView("gantt")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${
                view === "gantt"
                  ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                  : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              <GanttChartSquare size={14} /> 甘特圖
            </button>
            <button
              type="button"
              onClick={() => setView("report")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${
                view === "report"
                  ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                  : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              <BarChart3 size={14} /> 報表
            </button>
          </div>
        </div>
      </div>

      <div className={`flex-1 p-6 ${view === "table" ? "overflow-hidden" : "overflow-auto"}`}>
        {view === "table" && (
          <BoardTable
            board={board}
            users={users}
            userRole={userRole}
            currentUserId={currentUserId}
            onAddColumn={() => setAddColumnOpen(true)}
            highlightItemId={ganttNavigateHighlight ?? highlightItemId}
            holidays={holidays}
          />
        )}
        {view === "kanban" && (
          <BoardKanban
            board={board}
            statusColumns={statusColumns}
            columnId={kanbanColumnId || statusColumns[0]?.id || ""}
            onChangeColumn={setKanbanColumnId}
            users={users}
            userRole={userRole}
            currentUserId={currentUserId}
            holidays={holidays}
          />
        )}
        {view === "gantt" && (
          <BoardGantt
            board={board}
            users={users}
            userRole={userRole}
            currentUserId={currentUserId}
            holidays={holidays}
            onNavigateToItem={goToItemInTable}
          />
        )}
        {view === "report" && (
          <BoardReport
            board={board}
            users={users}
            userRole={userRole}
            currentUserId={currentUserId}
            holidays={holidays}
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
        <ExportGanttModal
          board={board}
          open={exportOpen}
          onOpenChange={setExportOpen}
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

    </div>
  );
}
