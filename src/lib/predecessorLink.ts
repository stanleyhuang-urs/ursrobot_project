import { prisma } from "@/lib/prisma";
import { getStatusOptions } from "@/types/column";

export type RelationshipType = "FS" | "FF" | "SS" | "SF";

/**
 * Rebuilds each item's WBS-style code (e.g. "1.3.4") from the board's
 * current group/parent/order structure, flat across all top-level items
 * (matches how the original imported "Pred" text was numbered).
 */
export async function buildWbsIndex(
  boardId: string
): Promise<{ wbsByItemId: Map<string, string>; itemIdByWbs: Map<string, string> }> {
  const items = await prisma.item.findMany({
    where: { boardId },
    select: { id: true, parentId: true, order: true },
  });

  const childrenByParent = new Map<string | null, typeof items>();
  for (const item of items) {
    const list = childrenByParent.get(item.parentId) ?? [];
    list.push(item);
    childrenByParent.set(item.parentId, list);
  }
  for (const list of childrenByParent.values()) list.sort((a, b) => a.order - b.order);

  const wbsByItemId = new Map<string, string>();
  function assign(parentId: string | null, prefix: string) {
    const kids = childrenByParent.get(parentId) ?? [];
    kids.forEach((kid, idx) => {
      const code = prefix ? `${prefix}.${idx + 1}` : String(idx + 1);
      wbsByItemId.set(kid.id, code);
      assign(kid.id, code);
    });
  }
  assign(null, "");

  const itemIdByWbs = new Map<string, string>();
  for (const [id, code] of wbsByItemId) itemIdByWbs.set(code, id);

  return { wbsByItemId, itemIdByWbs };
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime());
}

/**
 * Classifies the dependency type by finding which pair of endpoints (this
 * item's vs. the predecessor's Start/Finish) is closest together -- exact
 * equality isn't required since real schedules often carry lag/lead time.
 */
export function classifyRelationship(
  myStart: string,
  myFinish: string,
  predStart: string,
  predFinish: string
): RelationshipType {
  const candidates: { type: RelationshipType; gap: number }[] = [
    { type: "FS", gap: daysBetween(myStart, predFinish) },
    { type: "FF", gap: daysBetween(myFinish, predFinish) },
    { type: "SS", gap: daysBetween(myStart, predStart) },
    { type: "SF", gap: daysBetween(myFinish, predStart) },
  ];
  candidates.sort((a, b) => a.gap - b.gap);
  return candidates[0].type;
}

/**
 * Recomputes the Link (relationship type) value for a single item, based on
 * its Pred text (resolved to a predecessor item via the WBS index) and both
 * items' Start/Finish dates. Returns null if it can't be determined.
 */
export async function computeLinkForItem(
  boardId: string,
  itemId: string,
  predColumnId: string,
  startColumnId: string,
  endColumnId: string,
  itemIdByWbs: Map<string, string>
): Promise<RelationshipType | null> {
  const [predCell, startCell, endCell] = await Promise.all([
    prisma.cellValue.findUnique({ where: { itemId_columnId: { itemId, columnId: predColumnId } } }),
    prisma.cellValue.findUnique({ where: { itemId_columnId: { itemId, columnId: startColumnId } } }),
    prisma.cellValue.findUnique({ where: { itemId_columnId: { itemId, columnId: endColumnId } } }),
  ]);

  const predValue = predCell?.value;
  if (typeof predValue !== "string" || !predValue) return null;
  const predItemId = itemIdByWbs.get(predValue);
  if (!predItemId) return null;

  const myStart = startCell?.value;
  const myFinish = endCell?.value;
  if (typeof myStart !== "string" || typeof myFinish !== "string") return null;

  const [predStartCell, predFinishCell] = await Promise.all([
    prisma.cellValue.findUnique({
      where: { itemId_columnId: { itemId: predItemId, columnId: startColumnId } },
    }),
    prisma.cellValue.findUnique({
      where: { itemId_columnId: { itemId: predItemId, columnId: endColumnId } },
    }),
  ]);
  const predStart = predStartCell?.value;
  const predFinish = predFinishCell?.value;
  if (typeof predStart !== "string" || typeof predFinish !== "string") return null;

  return classifyRelationship(myStart, myFinish, predStart, predFinish);
}

/**
 * Writes the computed relationship type into the Link cell, matching it to
 * whichever of that column's status options is labeled FS/FF/SS/SF. Skips
 * silently if the column has no option for that label.
 */
export async function writeLinkValue(
  itemId: string,
  linkColumnId: string,
  relationship: RelationshipType | null
) {
  if (!relationship) return;
  const linkColumn = await prisma.column.findUnique({ where: { id: linkColumnId } });
  if (!linkColumn) return;
  const option = getStatusOptions(linkColumn.options).find((o) => o.label === relationship);
  if (!option) return;

  await prisma.cellValue.upsert({
    where: { itemId_columnId: { itemId, columnId: linkColumnId } },
    create: { itemId, columnId: linkColumnId, value: option.id },
    update: { value: option.id },
  });
}

/**
 * Keeps a board's designated Link column in sync with Pred + Start/Finish:
 * editing Pred recomputes that item's own Link; editing Start/Finish
 * recomputes that item's Link plus every other item whose Pred points at it
 * (their relationship type depends on this item's dates too).
 */
export async function syncPredecessorLink(
  boardId: string,
  itemId: string,
  editedColumnId: string
) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { predColumnId: true, linkColumnId: true, ganttStartColumnId: true, ganttEndColumnId: true },
  });
  const predColumnId = board?.predColumnId;
  const linkColumnId = board?.linkColumnId;
  const startColumnId = board?.ganttStartColumnId;
  const endColumnId = board?.ganttEndColumnId;
  if (!predColumnId || !linkColumnId || !startColumnId || !endColumnId) return;
  if (![predColumnId, startColumnId, endColumnId].includes(editedColumnId)) return;

  const { itemIdByWbs, wbsByItemId } = await buildWbsIndex(boardId);

  const relationship = await computeLinkForItem(
    boardId,
    itemId,
    predColumnId,
    startColumnId,
    endColumnId,
    itemIdByWbs
  );
  await writeLinkValue(itemId, linkColumnId, relationship);

  if (editedColumnId === startColumnId || editedColumnId === endColumnId) {
    const myWbs = wbsByItemId.get(itemId);
    if (!myWbs) return;
    const dependents = await prisma.cellValue.findMany({
      where: { columnId: predColumnId, value: { equals: myWbs } },
      select: { itemId: true },
    });
    for (const dep of dependents) {
      if (dep.itemId === itemId) continue;
      const depRelationship = await computeLinkForItem(
        boardId,
        dep.itemId,
        predColumnId,
        startColumnId,
        endColumnId,
        itemIdByWbs
      );
      await writeLinkValue(dep.itemId, linkColumnId, depRelationship);
    }
  }
}
