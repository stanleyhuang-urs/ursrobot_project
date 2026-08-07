"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { createComment, listComments } from "@/lib/actions/comment";

export function ItemDetailModal({
  boardId,
  itemId,
  itemName,
  open,
  onOpenChange,
}: {
  boardId: string;
  itemId: string;
  itemName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [comments, setComments] = useState<
    Awaited<ReturnType<typeof listComments>>
  >([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
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
  }, [open, itemId]);

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
    <Modal open={open} onOpenChange={onOpenChange} title={itemName} size="lg">
      <div className="mb-4 max-h-80 space-y-3 overflow-auto">
        {loading && <p className="text-sm text-neutral-400">載入中...</p>}
        {!loading && comments.length === 0 && (
          <p className="text-sm text-neutral-400">還沒有留言</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="rounded-md bg-neutral-50 p-2">
            <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
              <span className="font-medium text-neutral-700">
                {c.author.name}
              </span>
              <span>{new Date(c.createdAt).toLocaleString("zh-TW")}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-neutral-800">
              {c.body}
            </p>
          </div>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="新增留言..."
        rows={3}
        className="mb-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
      />
      <button
        type="button"
        disabled={submitting || !body.trim()}
        onClick={handleSubmit}
        className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "送出中..." : "送出留言"}
      </button>
    </Modal>
  );
}
