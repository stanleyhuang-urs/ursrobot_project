import { Prisma } from "@prisma/client";

export const boardWithDataArgs = Prisma.validator<Prisma.BoardDefaultArgs>()({
  include: {
    groups: { orderBy: { order: "asc" } },
    columns: { orderBy: { order: "asc" } },
    items: {
      orderBy: { order: "asc" },
      include: {
        cellValues: true,
        _count: { select: { comments: true } },
        assignments: { include: { user: { select: { id: true, name: true } } } },
      },
    },
  },
});

export type BoardWithData = Prisma.BoardGetPayload<typeof boardWithDataArgs>;
export type GroupData = BoardWithData["groups"][number];
export type ColumnData = BoardWithData["columns"][number];
export type ItemData = BoardWithData["items"][number];
export type CellValueData = ItemData["cellValues"][number];
export type AssignmentData = ItemData["assignments"][number];

export type UserOption = {
  id: string;
  name: string;
  supervisorId?: string | null;
  avatarUrl?: string | null;
  // Set for entries backed by a Resource (tool/vendor) rather than a real
  // User — they can be a PERSON-column 負責人, but have no account, so
  // anything with a real FK to User (e.g. Gantt Assignments) must exclude them.
  isResource?: boolean;
};
