"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { setLevelColors } from "@/lib/actions/column";

const MAX_LEVELS = 6;

export function LevelColorSettingsModal({
  boardId,
  levelColors,
  open,
  onOpenChange,
}: {
  boardId: string;
  levelColors: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [colors, setColors] = useState<string[]>(() => {
    const next = [...levelColors];
    while (next.length < MAX_LEVELS) next.push("");
    return next.slice(0, MAX_LEVELS);
  });
  const [saving, setSaving] = useState(false);

  function updateColor(index: number, color: string) {
    setColors((prev) => prev.map((c, i) => (i === index ? color : c)));
  }

  function clearColor(index: number) {
    setColors((prev) => prev.map((c, i) => (i === index ? "" : c)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setLevelColors(boardId, colors);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="階層顏色設定">
      <p className="mb-4 text-xs text-neutral-500">
        依項目在表格中的巢狀階層(Lvl 1~{MAX_LEVELS})設定整列背景色,未設定的階層維持預設(無底色)
      </p>
      <div className="mb-4 space-y-2">
        {colors.map((color, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-sm text-neutral-700">Lv {i + 1}</span>
            <input
              type="color"
              value={color || "#ffffff"}
              onChange={(e) => updateColor(i, e.target.value)}
              className="h-8 w-14 shrink-0 cursor-pointer rounded border border-neutral-300"
            />
            <span className="min-w-0 flex-1 truncate text-xs text-neutral-400">
              {color || "未設定"}
            </span>
            {color && (
              <button
                type="button"
                onClick={() => clearColor(i)}
                className="shrink-0 text-xs text-neutral-400 hover:text-red-600"
              >
                清除
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "儲存中..." : "儲存"}
      </button>
    </Modal>
  );
}
