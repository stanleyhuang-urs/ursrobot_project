"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireBoardAdmin } from "@/lib/permissions";
import { parseNumberInput } from "@/lib/cellValue";
import { parseWorkbookBuffer, type ParsedWorkbook } from "@/lib/import/parseFile";
import {
  DEFAULT_STATUSES,
  DEFAULT_STATUS_PALETTE,
  getStatusOptions,
  type ColumnType,
  type StatusOption,
} from "@/types/column";
import type { ImportRowsInput, ImportResult } from "@/types/import";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["csv", "xlsx", "xls"];

export async function parseImportFile(
  formData: FormData
): Promise<ParsedWorkbook> {
  const session = await requireSession();
  requireBoardAdmin(session.role);

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("請選擇檔案");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("檔案大小不可超過 10MB");
  }
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error("僅支援 .csv、.xlsx、.xls 檔案");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return parseWorkbookBuffer(buffer, file.name);
}

export async function parseImportFromUrl(url: string): Promise<ParsedWorkbook> {
  const session = await requireSession();
  requireBoardAdmin(session.role);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("請輸入有效的網址");
  }

  if (parsed.hostname !== "docs.google.com") {
    throw new Error("僅支援 docs.google.com 的 Google Sheet 連結");
  }

  const match = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    throw new Error("無法從網址取得 Google Sheet ID,請確認網址格式");
  }
  const exportUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;

  const res = await fetch(exportUrl);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "無法存取此 Google Sheet(需要登入)。請將分享設定改為「知道連結的使用者」皆可檢視,或改用「上傳檔案」方式匯入。"
      );
    }
    throw new Error(`無法讀取此 Google Sheet(HTTP ${res.status})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return parseWorkbookBuffer(buffer, "sheet.xlsx");
}

function normalizeDateInput(raw: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type ImportStats = {
  personMismatchCount: number;
  numberParseFailCount: number;
};

async function coerceValue(
  tx: Prisma.TransactionClient,
  columnId: string,
  columnType: ColumnType | undefined,
  rawValue: string | null,
  statusOptionsById: Map<string, StatusOption[]>,
  usersByName: Map<string, string>,
  stats: ImportStats
): Promise<string | number | undefined> {
  if (rawValue === null || rawValue.trim() === "") return undefined;
  const trimmed = rawValue.trim();

  switch (columnType) {
    case "NUMBER": {
      const parsed = parseNumberInput(trimmed);
      if (parsed === null) stats.numberParseFailCount++;
      return parsed ?? undefined;
    }
    case "DATE":
      return normalizeDateInput(trimmed);
    case "PERSON": {
      const userId = usersByName.get(trimmed.toLowerCase());
      if (!userId) stats.personMismatchCount++;
      return userId;
    }
    case "STATUS": {
      const options = statusOptionsById.get(columnId) ?? [];
      const match = options.find(
        (o) => o.label.toLowerCase() === trimmed.toLowerCase()
      );
      if (match) return match.id;

      const newOption: StatusOption = {
        id: randomUUID().slice(0, 8),
        label: trimmed,
        color:
          DEFAULT_STATUS_PALETTE[options.length % DEFAULT_STATUS_PALETTE.length],
      };
      const updated = [...options, newOption];
      statusOptionsById.set(columnId, updated);
      await tx.column.update({
        where: { id: columnId },
        data: { options: { statuses: updated } },
      });
      return newOption.id;
    }
    case "TEXT":
    default:
      return trimmed;
  }
}

export async function importRows(
  input: ImportRowsInput
): Promise<ImportResult> {
  const session = await requireSession();
  requireBoardAdmin(session.role);
  const { boardId, groupId, dataRows, mappings } = input;

  const nameMappings = mappings.filter((m) => m.target.kind === "name");
  if (nameMappings.length !== 1) {
    throw new Error("請指定剛好一欄作為「項目名稱」");
  }
  const nameColIndex = nameMappings[0].sourceColIndex;

  const levelMapping = mappings.find((m) => m.target.kind === "level");
  const levelColIndex = levelMapping?.sourceColIndex;

  const valueMappings = mappings.filter(
    (m) => m.target.kind === "existingColumn" || m.target.kind === "newColumn"
  );

  return prisma.$transaction(
    async (tx) => {
      const existingColumns = await tx.column.findMany({ where: { boardId } });
      let columnOrderCounter = existingColumns.length;

      const columnTypeById = new Map<string, ColumnType>();
      const statusOptionsById = new Map<string, StatusOption[]>();
      for (const c of existingColumns) {
        columnTypeById.set(c.id, c.type as ColumnType);
        if (c.type === "STATUS") {
          statusOptionsById.set(c.id, getStatusOptions(c.options));
        }
      }

      const columnIdByColIndex = new Map<number, string>();
      let newColumnCount = 0;

      for (const mapping of valueMappings) {
        if (mapping.target.kind === "existingColumn") {
          columnIdByColIndex.set(mapping.sourceColIndex, mapping.target.columnId);
        } else if (mapping.target.kind === "newColumn") {
          const options =
            mapping.target.columnType === "STATUS"
              ? { statuses: DEFAULT_STATUSES }
              : {};
          const created = await tx.column.create({
            data: {
              boardId,
              name: mapping.target.name.trim() || "匯入欄位",
              type: mapping.target.columnType,
              order: columnOrderCounter++,
              options,
            },
          });
          columnIdByColIndex.set(mapping.sourceColIndex, created.id);
          columnTypeById.set(created.id, mapping.target.columnType);
          if (mapping.target.columnType === "STATUS") {
            statusOptionsById.set(created.id, DEFAULT_STATUSES);
          }
          newColumnCount++;
        }
      }

      const users = await tx.user.findMany({ select: { id: true, name: true } });
      const usersByName = new Map(
        users.map((u) => [u.name.toLowerCase(), u.id] as const)
      );

      const topLevelCount = await tx.item.count({
        where: { groupId, parentId: null },
      });
      const orderCounters = new Map<string | null, number>();
      orderCounters.set(null, topLevelCount);

      const stack: { level: number; itemId: string }[] = [];
      const cellValuesToCreate: {
        itemId: string;
        columnId: string;
        value: string | number;
      }[] = [];
      let itemCount = 0;
      const stats: ImportStats = { personMismatchCount: 0, numberParseFailCount: 0 };

      for (const row of dataRows) {
        const rawName = row[nameColIndex];
        const name = rawName?.trim();
        if (!name) continue;

        const rawLevel = levelColIndex !== undefined ? row[levelColIndex] : null;
        const parsedLevel = rawLevel ? parseInt(rawLevel, 10) : 1;
        const level = Number.isFinite(parsedLevel) && parsedLevel >= 1 ? parsedLevel : 1;

        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }
        const parentId = stack.length > 0 ? stack[stack.length - 1].itemId : null;

        const order = orderCounters.get(parentId) ?? 0;
        orderCounters.set(parentId, order + 1);

        const item = await tx.item.create({
          data: { boardId, groupId, parentId, name, order },
        });
        itemCount++;
        stack.push({ level, itemId: item.id });

        for (const mapping of valueMappings) {
          const columnId = columnIdByColIndex.get(mapping.sourceColIndex);
          if (!columnId) continue;
          const value = await coerceValue(
            tx,
            columnId,
            columnTypeById.get(columnId),
            row[mapping.sourceColIndex] ?? null,
            statusOptionsById,
            usersByName,
            stats
          );
          if (value === undefined) continue;
          cellValuesToCreate.push({ itemId: item.id, columnId, value });
        }
      }

      if (cellValuesToCreate.length > 0) {
        await tx.cellValue.createMany({ data: cellValuesToCreate });
      }

      revalidatePath(`/boards/${boardId}`);
      return { itemCount, newColumnCount, ...stats };
    },
    { timeout: 20000 }
  );
}
