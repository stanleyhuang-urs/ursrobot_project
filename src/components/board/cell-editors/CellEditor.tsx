import type { ColumnData, UserOption } from "@/types/board";
import { TextCell } from "./TextCell";
import { StatusCell } from "./StatusCell";
import { PersonCell } from "./PersonCell";
import { DateCell } from "./DateCell";
import { NumberCell } from "./NumberCell";

function ReadOnlyCell({
  column,
  value,
  users,
}: {
  column: ColumnData;
  value: string | number | null;
  users: UserOption[];
}) {
  let display = "";
  if (column.type === "PERSON") {
    display = users.find((u) => u.id === value)?.name ?? "";
  } else if (value !== null) {
    display = String(value);
  }
  return (
    <span className="block truncate px-2 py-1 text-sm text-neutral-600" title={display}>
      {display}
    </span>
  );
}

export function CellEditor({
  boardId,
  itemId,
  column,
  value,
  users,
  canEdit = true,
}: {
  boardId: string;
  itemId: string;
  column: ColumnData;
  value: string | number | null;
  users: UserOption[];
  canEdit?: boolean;
}) {
  if (!canEdit) {
    return <ReadOnlyCell column={column} value={value} users={users} />;
  }

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
