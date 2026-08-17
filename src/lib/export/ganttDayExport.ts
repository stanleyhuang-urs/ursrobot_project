import ExcelJS from "exceljs";
import type { BoardWithData, ColumnData, GroupData, ItemData } from "@/types/board";
import { computeWbsCodes } from "@/lib/wbs";
import { getStatusOptions } from "@/types/column";

const HEADERS = [
  "Lvl",
  "WBS",
  "Task Name",
  "Type",
  "Priority",
  "Status",
  "Resource",
  "Pred",
  "Link",
  "Lag",
  "Comment",
  "Start (set)",
  "Start",
  "Dur",
  "Days",
  "Finish",
  "% Done",
];

const COLUMN_WIDTHS = [6, 12, 40, 12, 10, 12, 24, 10, 8, 8, 30, 12, 12, 8, 8, 12, 10];

function findColumn(columns: ColumnData[], name: string): ColumnData | undefined {
  const target = name.trim().toLowerCase();
  return columns.find((c) => c.name.trim().toLowerCase() === target);
}

function getRawValue(item: ItemData, column: ColumnData | undefined): string | number | null {
  if (!column) return null;
  const value = item.cellValues.find((cv) => cv.columnId === column.id)?.value;
  return value === undefined ? null : (value as string | number | null);
}

function getRawValueByColumnId(item: ItemData, columnId: string | null): string | number | null {
  if (!columnId) return null;
  const value = item.cellValues.find((cv) => cv.columnId === columnId)?.value;
  return value === undefined ? null : (value as string | number | null);
}

function getStatusLabel(item: ItemData, column: ColumnData | undefined): string {
  if (!column) return "";
  const value = getRawValue(item, column);
  if (value == null) return "";
  const options = getStatusOptions(column.options);
  return options.find((o) => o.id === value)?.label ?? "";
}

/**
 * The board's "% Done" values are stored inconsistently — some rows hold a
 * 0-1 fraction, others a raw 0-100 percentage — the same ambiguity the
 * reference .gs script's own `norm()` helper works around. Match that
 * convention so leaf values and rollups stay comparable to the target sheet.
 */
function normalizePercent(raw: number): number {
  return raw > 1 ? raw / 100 : raw;
}

function leafPercent(item: ItemData, progressColumnId: string | null): number | null {
  if (!progressColumnId) return null;
  const cv = item.cellValues.find((c) => c.columnId === progressColumnId);
  return typeof cv?.value === "number" ? normalizePercent(cv.value) : null;
}

function orderedItems(items: ItemData[]): { ordered: ItemData[]; childrenOf: Map<string | null, ItemData[]> } {
  const byParent = new Map<string | null, ItemData[]>();
  for (const item of items) {
    const list = byParent.get(item.parentId) ?? [];
    list.push(item);
    byParent.set(item.parentId, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.order - b.order);

  const ordered: ItemData[] = [];
  function walk(parentId: string | null) {
    for (const child of byParent.get(parentId) ?? []) {
      ordered.push(child);
      walk(child.id);
    }
  }
  walk(null);

  return { ordered, childrenOf: byParent };
}

/**
 * Builds a single-sheet .xlsx matching the "Gantt (Day)" tab layout of the
 * reference Google Sheet (header row 6, data from row 7), so it can be
 * pasted directly into the existing sheet — Week/Month mirrors, conditional
 * formatting, and the Apps Script menu all stay untouched and pick up the
 * new data automatically.
 */
export async function buildGanttDayWorkbook(board: BoardWithData, group: GroupData): Promise<Buffer> {
  const items = board.items.filter((i) => i.groupId === group.id);
  const wbsCodes = computeWbsCodes(items);
  const { ordered, childrenOf } = orderedItems(items);

  const typeColumn = findColumn(board.columns, "Type");
  const priorityColumn = findColumn(board.columns, "Priority");
  const statusColumn = findColumn(board.columns, "Status");
  const resourceColumn = findColumn(board.columns, "Resource");
  const predColumn = findColumn(board.columns, "Pred");
  const linkColumn = findColumn(board.columns, "Link");
  const lagColumn = findColumn(board.columns, "Lag");
  const commentColumn = findColumn(board.columns, "Comment");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Gantt (Day)");

  sheet.getCell("A1").value = `${board.name} - ${group.name}`;
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.mergeCells("A5:Q5");
  sheet.getCell("A5").value = "TASK DETAILS";
  sheet.getCell("A5").font = { bold: true };

  const headerRow = sheet.getRow(6);
  HEADERS.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  headerRow.font = { bold: true };
  COLUMN_WIDTHS.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  // First pass: resolve each item's WBS/effective-type up front, since the
  // % Done rollup below needs the whole set to find every descendant leaf.
  const meta = ordered.map((item) => {
    const wbs = wbsCodes.get(item.id) ?? "";
    const hasChildren = (childrenOf.get(item.id) ?? []).length > 0;
    const type = getStatusLabel(item, typeColumn) || (hasChildren ? "Summary" : "Task");
    return { item, wbs, hasChildren, type };
  });

  /** Flat average of every descendant leaf's % Done, matching the
   *  reference sheet's own RollupSummaries() logic (excludes nested
   *  Summary rows, not weighted by subtree shape). */
  function rollupPercent(wbs: string): number | null {
    if (!board.progressColumnId) return null;
    const prefix = `${wbs}.`;
    let sum = 0;
    let count = 0;
    for (const m of meta) {
      if (!m.wbs.startsWith(prefix) || m.type === "Summary") continue;
      const pct = leafPercent(m.item, board.progressColumnId);
      sum += pct ?? 0;
      count++;
    }
    return count > 0 ? sum / count : null;
  }

  let rowIndex = 7;
  for (const { item, wbs, hasChildren, type } of meta) {
    const lvl = wbs ? wbs.split(".").length : 1;
    const startRaw = getRawValueByColumnId(item, board.ganttStartColumnId);
    const finishRaw = getRawValueByColumnId(item, board.ganttEndColumnId);
    const durRaw = getRawValueByColumnId(item, board.ganttDurationColumnId);
    const pctDone = hasChildren ? rollupPercent(wbs) : leafPercent(item, board.progressColumnId);

    const row = sheet.getRow(rowIndex);
    row.getCell(1).value = lvl;
    row.getCell(2).value = wbs;
    row.getCell(3).value = item.name;
    row.getCell(4).value = type;
    row.getCell(5).value = getStatusLabel(item, priorityColumn);
    row.getCell(6).value = getStatusLabel(item, statusColumn);
    row.getCell(7).value = (getRawValue(item, resourceColumn) as string | null) ?? "";
    row.getCell(8).value = (getRawValue(item, predColumn) as string | null) ?? "";
    row.getCell(9).value = getStatusLabel(item, linkColumn);
    row.getCell(10).value = (getRawValue(item, lagColumn) as number | null) ?? "";
    row.getCell(11).value = (getRawValue(item, commentColumn) as string | null) ?? "";
    // column 12 "Start (set)" intentionally left blank — this app always
    // stores the effective/resolved start, not a manual override.

    if (typeof startRaw === "string") {
      const d = new Date(startRaw);
      if (!Number.isNaN(d.getTime())) {
        row.getCell(13).value = d;
        row.getCell(13).numFmt = "yyyy-mm-dd";
      }
    }
    if (typeof durRaw === "number") {
      row.getCell(14).value = durRaw;
      row.getCell(15).value = durRaw;
    }
    if (typeof finishRaw === "string") {
      const d = new Date(finishRaw);
      if (!Number.isNaN(d.getTime())) {
        row.getCell(16).value = d;
        row.getCell(16).numFmt = "yyyy-mm-dd";
      }
    }
    if (pctDone !== null) {
      row.getCell(17).value = pctDone;
      row.getCell(17).numFmt = "0%";
    }

    rowIndex++;
  }

  sheet.views = [{ state: "frozen", xSplit: 3, ySplit: 6 }];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
