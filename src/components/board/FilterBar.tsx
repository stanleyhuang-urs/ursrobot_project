"use client";

import { Plus, X } from "lucide-react";
import type { ColumnData, UserOption } from "@/types/board";
import { getStatusOptions } from "@/types/column";
import type { ActiveFilter, FilterValue } from "@/lib/filter";

function defaultValueFor(type: ColumnData["type"]): FilterValue {
  switch (type) {
    case "STATUS":
      return { kind: "status", selected: [] };
    case "PERSON":
      return { kind: "person", selected: [] };
    case "NUMBER":
      return { kind: "number", min: null, max: null };
    case "DATE":
      return { kind: "date", from: null, to: null };
    default:
      return { kind: "text", query: "" };
  }
}

export function FilterBar({
  columns,
  users,
  filters,
  onChange,
}: {
  columns: ColumnData[];
  users: UserOption[];
  filters: ActiveFilter[];
  onChange: (filters: ActiveFilter[]) => void;
}) {
  function addFilter() {
    const firstColumn = columns[0];
    if (!firstColumn) return;
    onChange([...filters, { columnId: firstColumn.id, value: defaultValueFor(firstColumn.type) }]);
  }

  function updateFilter(index: number, next: ActiveFilter) {
    onChange(filters.map((f, i) => (i === index ? next : f)));
  }

  function removeFilter(index: number) {
    onChange(filters.filter((_, i) => i !== index));
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {filters.map((filter, index) => {
        const column = columns.find((c) => c.id === filter.columnId);
        if (!column) return null;
        return (
          <div
            key={index}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1"
          >
            <select
              value={filter.columnId}
              onChange={(e) => {
                const col = columns.find((c) => c.id === e.target.value);
                if (col) updateFilter(index, { columnId: col.id, value: defaultValueFor(col.type) });
              }}
              className="rounded border-none bg-transparent text-xs font-medium text-neutral-700 outline-none"
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FilterValueControl
              column={column}
              value={filter.value}
              users={users}
              onChange={(value) => updateFilter(index, { columnId: filter.columnId, value })}
            />
            <button
              type="button"
              onClick={() => removeFilter(index)}
              className="text-neutral-400 hover:text-red-600"
              aria-label="移除篩選"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={addFilter}
        className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
      >
        <Plus size={14} /> 篩選
      </button>
    </div>
  );
}

function FilterValueControl({
  column,
  value,
  users,
  onChange,
}: {
  column: ColumnData;
  value: FilterValue;
  users: UserOption[];
  onChange: (value: FilterValue) => void;
}) {
  if (value.kind === "text") {
    return (
      <input
        value={value.query}
        onChange={(e) => onChange({ kind: "text", query: e.target.value })}
        placeholder="包含文字..."
        className="w-28 rounded border border-neutral-200 px-1.5 py-0.5 text-xs outline-none focus:border-blue-500"
      />
    );
  }

  if (value.kind === "status") {
    const options = getStatusOptions(column.options);
    return (
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const active = value.selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() =>
                onChange({
                  kind: "status",
                  selected: active
                    ? value.selected.filter((id) => id !== o.id)
                    : [...value.selected, o.id],
                })
              }
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                active ? "text-white" : "border border-neutral-200 text-neutral-500"
              }`}
              style={active ? { backgroundColor: o.color } : undefined}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (value.kind === "person") {
    return (
      <div className="flex max-w-xs flex-wrap gap-1">
        {users.map((u) => {
          const active = value.selected.includes(u.id);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() =>
                onChange({
                  kind: "person",
                  selected: active
                    ? value.selected.filter((id) => id !== u.id)
                    : [...value.selected, u.id],
                })
              }
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                active
                  ? "bg-neutral-800 text-white"
                  : "border border-neutral-200 text-neutral-500"
              }`}
            >
              {u.name}
            </button>
          );
        })}
      </div>
    );
  }

  if (value.kind === "number") {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value.min ?? ""}
          onChange={(e) =>
            onChange({
              kind: "number",
              min: e.target.value === "" ? null : Number(e.target.value),
              max: value.max,
            })
          }
          placeholder="最小"
          className="w-14 rounded border border-neutral-200 px-1 py-0.5 text-xs outline-none focus:border-blue-500"
        />
        <span className="text-neutral-400">~</span>
        <input
          type="number"
          value={value.max ?? ""}
          onChange={(e) =>
            onChange({
              kind: "number",
              min: value.min,
              max: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          placeholder="最大"
          className="w-14 rounded border border-neutral-200 px-1 py-0.5 text-xs outline-none focus:border-blue-500"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="date"
        value={value.from ?? ""}
        onChange={(e) => onChange({ kind: "date", from: e.target.value || null, to: value.to })}
        className="w-32 rounded border border-neutral-200 px-1 py-0.5 text-xs outline-none focus:border-blue-500"
      />
      <span className="text-neutral-400">~</span>
      <input
        type="date"
        value={value.to ?? ""}
        onChange={(e) => onChange({ kind: "date", from: value.from, to: e.target.value || null })}
        className="w-32 rounded border border-neutral-200 px-1 py-0.5 text-xs outline-none focus:border-blue-500"
      />
    </div>
  );
}
