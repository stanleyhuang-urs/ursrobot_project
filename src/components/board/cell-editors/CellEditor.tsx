import type { ColumnData, UserOption } from "@/types/board";
import { getStatusOptions } from "@/types/column";
import { TextCell } from "./TextCell";
import { StatusCell } from "./StatusCell";
import { PersonCell } from "./PersonCell";
import { DateCell } from "./DateCell";
import { NumberCell } from "./NumberCell";

function ReadOnlyCell({
  column,
  value,
  users,
  isProgressColumn,
}: {
  column: ColumnData;
  value: string | number | null;
  users: UserOption[];
  isProgressColumn: boolean;
}) {
  if (column.type === "STATUS") {
    const option = getStatusOptions(column.options).find((o) => o.id === value);
    if (!option) return <span className="block px-2 py-1" />;
    return (
      <span
        title={option.label}
        className="mx-2 flex h-7 items-center truncate rounded px-2 text-xs font-medium text-white"
        style={{ backgroundColor: option.color }}
      >
        {option.label}
      </span>
    );
  }

  let display = "";
  if (column.type === "PERSON") {
    display = users.find((u) => u.id === value)?.name ?? "";
  } else if (isProgressColumn && column.type === "NUMBER" && typeof value === "number") {
    display = `${Math.round(value * 100)}%`;
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
  isProgressColumn = false,
}: {
  boardId: string;
  itemId: string;
  column: ColumnData;
  value: string | number | null;
  users: UserOption[];
  canEdit?: boolean;
  isProgressColumn?: boolean;
}) {
  if (!canEdit) {
    return <ReadOnlyCell column={column} value={value} users={users} isProgressColumn={isProgressColumn} />;
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
          percent={isProgressColumn}
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
