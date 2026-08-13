"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addTodoItem, deleteTodoItem, listTodoItems, toggleTodoItem } from "@/lib/actions/todo";

export function ChecklistTab({ boardId, itemId }: { boardId: string; itemId: string }) {
  const [todos, setTodos] = useState<Awaited<ReturnType<typeof listTodoItems>>>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");

  async function refresh() {
    setTodos(await listTodoItems(itemId));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await listTodoItems(itemId);
        if (!cancelled) setTodos(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  async function handleAdd() {
    if (!text.trim()) return;
    await addTodoItem(boardId, itemId, text.trim());
    setText("");
    await refresh();
  }

  async function handleToggle(todoId: string, done: boolean) {
    await toggleTodoItem(boardId, itemId, todoId, done);
    await refresh();
  }

  async function handleDelete(todoId: string) {
    await deleteTodoItem(boardId, itemId, todoId);
    await refresh();
  }

  const doneCount = todos.filter((t) => t.done).length;

  return (
    <div>
      {todos.length > 0 && (
        <p className="mb-3 text-xs text-neutral-400">
          {doneCount} / {todos.length} 已完成
        </p>
      )}
      {loading && <p className="text-sm text-neutral-400">載入中...</p>}
      {!loading && todos.length === 0 && (
        <p className="mb-3 text-sm text-neutral-400">尚無待辦事項</p>
      )}
      <ul className="mb-4 space-y-1.5">
        {todos.map((t) => (
          <li
            key={t.id}
            className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-neutral-50"
          >
            <input
              type="checkbox"
              checked={t.done}
              onChange={(e) => handleToggle(t.id, e.target.checked)}
              className="shrink-0"
            />
            <span
              className={`min-w-0 flex-1 text-sm ${
                t.done ? "text-neutral-400 line-through" : "text-neutral-800"
              }`}
            >
              {t.text}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(t.id)}
              className="shrink-0 text-neutral-300 opacity-0 hover:text-red-600 group-hover:opacity-100"
              aria-label="刪除"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="+ 新增待辦事項"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!text.trim()}
          className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={14} /> 新增
        </button>
      </div>
    </div>
  );
}
