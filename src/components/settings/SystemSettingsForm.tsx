"use client";

import { useState, useTransition } from "react";
import { setEmailNotificationsEnabled } from "@/lib/actions/systemSettings";

export function SystemSettingsForm({
  emailNotificationsEnabled,
}: {
  emailNotificationsEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(emailNotificationsEnabled);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      await setEmailNotificationsEnabled(next);
    });
  }

  return (
    <div className="max-w-xl rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-neutral-900">Email 通知</p>
          <p className="text-xs text-neutral-500">
            開啟後,系統會在指派工作項目、觸發自動化規則時寄送 Email 通知給相關使用者。
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Email 通知"
          onClick={toggle}
          disabled={isPending}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-blue-600" : "bg-neutral-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      <p className="border-t border-neutral-100 px-4 py-2 text-xs text-neutral-400">
        目前狀態:{enabled ? "已開啟,將寄送 Email 通知" : "已關閉,不會寄送任何 Email 通知"}
      </p>
    </div>
  );
}
