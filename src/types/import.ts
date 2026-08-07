import type { ColumnType } from "./column";

export type ColumnMappingTarget =
  | { kind: "ignore" }
  | { kind: "name" }
  | { kind: "level" }
  | { kind: "existingColumn"; columnId: string }
  | { kind: "newColumn"; name: string; columnType: ColumnType };

export type ColumnMapping = {
  sourceColIndex: number;
  target: ColumnMappingTarget;
};

export type ImportRowsInput = {
  boardId: string;
  groupId: string;
  dataRows: (string | null)[][];
  mappings: ColumnMapping[];
};

export type ImportResult = {
  itemCount: number;
  newColumnCount: number;
  personMismatchCount: number;
  numberParseFailCount: number;
};
