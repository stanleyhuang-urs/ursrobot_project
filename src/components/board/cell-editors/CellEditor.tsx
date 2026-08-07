import type { ColumnData, UserOption } from "@/types/board";
import { TextCell } from "./TextCell";
import { StatusCell } from "./StatusCell";
import { PersonCell } from "./PersonCell";
import { DateCell } from "./DateCell";
import { NumberCell } from "./NumberCell";

export function CellEditor({
  boardId,
  itemId,
  column,
  value,
  users,
}: {
  boardId: string;
  itemId: string;
  column: ColumnData;
  value: string | number | null;
  users: UserOption[];
}) {
  switch (column.type) {
    case "TEXT":
      return (
        <TextCell
          boardId={boardId}
          itemId={itemId}
          columnId={column.id}
          value={typeof value === "string" ? value : ""}
        />
      );
    case "NUMBER":
      return (
        <NumberCell
          boardId={boardId}
          itemId={itemId}
          columnId={column.id}
          value={typeof value === "number" ? value : null}
        />
      );
    case "DATE":
      return (
        <DateCell
          boardId={boardId}
          itemId={itemId}
          columnId={column.id}
          value={typeof value === "string" ? value : null}
        />
      );
    case "PERSON":
      return (
        <PersonCell
          boardId={boardId}
          itemId={itemId}
          columnId={column.id}
          value={typeof value === "string" ? value : null}
          users={users}
        />
      );
    case "STATUS":
      return (
        <StatusCell
          boardId={boardId}
          itemId={itemId}
          columnId={column.id}
          value={typeof value === "string" ? value : null}
          options={column.options}
        />
      );
    default:
      return null;
  }
}
