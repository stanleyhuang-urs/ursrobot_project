"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { createComment, listComments } from "@/lib/actions/comment";

export function UpdatesTab({ boardId, itemId }: { boardId: string; itemId: string }) {
  const [comments, setComments] = useState<Awaited<ReturnType<typeof listComments>>>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await listComments(itemId);
        if (!cancelled) setComments(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  async function handleSubmit() {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      await createComment(boardId, itemId, body.trim());
      setComments(await listComments(itemId));
      setBody("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="新增更新..."
        rows={3}
        className="mb-2 w-full rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
      />
      <div className="mb-5 flex justify-end">
        <button
          type="button"
          disabled={submitting || !body.trim()}
          onClick={handleSubmit}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "送出中..." : "更新"}
        </button>
      </div>

      <div className="space-y-4">
        {loading && <p className="text-sm text-neutral-400 dark:text-neutral-500">載入中...</p>}
        {!loading && comments.length === 0 && (
          <p className="text-sm text-neutral-400 dark:text-neutral-500">還沒有更新</p>
        )}
        {[...comments].reverse().map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar name={c.author.name} avatarUrl={c.author.avatarUrl} size={32} />
            <div className="min-w-0 flex-1 border-b border-neutral-100 dark:border-neutral-700 pb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{c.author.name}</span>
                <span className="text-xs text-neutral-400 dark:text-neutral-500">
                  {new Date(c.createdAt).toLocaleString("zh-TW")}
                </span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-100">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
