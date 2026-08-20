"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { findTreeNode, findTreePath, type ParentTreeNode } from "@/lib/parentTaskTree";

function TreeRow({
  node,
  depth,
  selectedId,
  expanded,
  onToggleExpand,
  onSelect,
}: {
  node: ParentTreeNode;
  depth: number;
  selectedId: string;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const isExpanded = expanded.has(node.itemId);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node.itemId)}
        onKeyDown={(e) => e.key === "Enter" && onSelect(node.itemId)}
        className={`flex cursor-pointer items-center gap-1 py-1 pr-2 text-xs hover:bg-neutral-100 ${
          node.itemId === selectedId ? "bg-blue-50 font-medium text-blue-700" : "text-neutral-700"
        }`}
        style={{ paddingLeft: depth * 14 + 6 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.itemId);
            }}
            className="shrink-0 text-neutral-400 hover:text-neutral-600"
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="truncate">{node.itemName}</span>
      </div>
      {hasChildren &&
        isExpanded &&
        node.children.map((child) => (
          <TreeRow
            key={child.itemId}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

/** Expandable tree picker for selecting a parent task — items can be nested
 *  arbitrarily deep (not just 2 levels), so a flat <select> can't represent
 *  the hierarchy the way this can. */
export function ParentTaskPicker({
  tree,
  value,
  onChange,
}: {
  tree: ParentTreeNode[];
  value: string;
  onChange: (itemId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(value ? (findTreePath(tree, value) ?? []) : [])
  );
  const [lastSyncedValue, setLastSyncedValue] = useState(value);

  // Auto-expand the ancestor path of the selection whenever it changes, e.g.
  // when a create-form is reset to a new default parent.
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    const path = value ? findTreePath(tree, value) : null;
    if (path) setExpanded(new Set(path));
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedNode = value ? findTreeNode(tree, value) : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-56 max-w-[220px] truncate rounded-md border border-neutral-300 bg-white px-2 py-1 text-left text-xs outline-none focus:border-blue-500"
      >
        {selectedNode ? `${selectedNode.boardName} / ${selectedNode.itemName}` : "選擇父任務"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-64 w-72 overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg">
            {tree.map((node) => (
              <TreeRow
                key={node.itemId}
                node={node}
                depth={0}
                selectedId={value}
                expanded={expanded}
                onToggleExpand={toggleExpand}
                onSelect={(id) => {
                  onChange(id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
