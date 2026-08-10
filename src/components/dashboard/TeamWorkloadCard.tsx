"use client";

import { useState } from "react";
import type { TeamWorkloadEntry, WorkloadPeriod } from "@/lib/dashboard";

const PERIOD_LABELS: Record<WorkloadPeriod, string> = {
  day: "本日",
  week: "本週",
  month: "本月",
};

export function TeamWorkloadCard({
  title,
  day,
  week,
  month,
}: {
  title: string;
  day: TeamWorkloadEntry[];
  week: TeamWorkloadEntry[];
  month: TeamWorkloadEntry[];
}) {
  const [period, setPeriod] = useState<WorkloadPeriod>("day");
  const data = { day, week, month }[period];
  const isEmpty = data.every((e) => e.avgPct === 0);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">{title}</h2>
        <div className="flex overflow-hidden rounded-md border border-neutral-200 text-xs">
          {(Object.keys(PERIOD_LABELS) as WorkloadPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 ${
                period === p
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
      {isEmpty ? (
        <p className="text-sm text-neutral-400">
          尚無看板設定「開始日期欄位」與「天數欄位」,或此期間沒有任何人員分配。
        </p>
      ) : (
        <div className="space-y-2 rounded-md border border-neutral-200 bg-white p-4">
          {data.map((entry) => (
            <div key={entry.userId} className="flex items-center gap-3">
              <span className="w-20 shrink-0 truncate text-sm text-neutral-700">
                {entry.userName}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, entry.avgPct)}%`,
                    backgroundColor: entry.avgPct > 100 ? "#e2445c" : "#00c875",
                  }}
                />
              </div>
              <span
                className={`w-12 shrink-0 text-right text-sm ${
                  entry.avgPct > 100 ? "font-medium text-red-600" : "text-neutral-500"
                }`}
              >
                {entry.avgPct}%
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
