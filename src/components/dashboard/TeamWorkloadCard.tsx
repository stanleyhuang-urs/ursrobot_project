"use client";

import { useState } from "react";
import type { TeamWorkloadEntry, WorkloadPeriod, MemberItemWorkloadEntry } from "@/lib/dashboard";
import type { MemberTask } from "@/lib/workload";

const PERIOD_LABELS: Record<WorkloadPeriod, string> = {
  day: "本日",
  week: "本週",
  month: "本月",
};

const PIE_COLORS = [
  "#00c875",
  "#579bfc",
  "#fdab3d",
  "#e2445c",
  "#a25ddc",
  "#037f4c",
  "#ff642e",
  "#66ccff",
];

const FREE_TIME_COLOR = "#d1d5db";

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) };
}

function pieSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

export function TeamWorkloadCard({
  title,
  day,
  week,
  month,
  tasksByUser,
  memberItemWorkload,
}: {
  title: string;
  day: TeamWorkloadEntry[];
  week: TeamWorkloadEntry[];
  month: TeamWorkloadEntry[];
  tasksByUser: Record<string, MemberTask[]>;
  memberItemWorkload: Record<string, Record<WorkloadPeriod, MemberItemWorkloadEntry[]>>;
}) {
  const [period, setPeriod] = useState<WorkloadPeriod>("day");
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [pieUserId, setPieUserId] = useState<string | null>(null);
  const data = { day, week, month }[period];
  const isEmpty = data.every((e) => e.avgPct === 0);
  const selectedPieUserId = pieUserId ?? data[0]?.userId ?? null;
  const pieEntries = selectedPieUserId ? memberItemWorkload[selectedPieUserId]?.[period] ?? [] : [];
  const pieAllocatedPct = pieEntries.reduce((sum, e) => sum + e.avgPct, 0);
  const pieFreePct = Math.max(0, 100 - pieAllocatedPct);
  const pieDenominator = pieAllocatedPct + pieFreePct;

  function toggleExpanded(userId: string) {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">{title}</h2>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-neutral-200 text-xs">
            {(["bar", "pie"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setChartType(t)}
                className={`px-2.5 py-1 ${
                  chartType === t
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {t === "bar" ? "長條圖" : "圓餅圖"}
              </button>
            ))}
          </div>
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
      </div>
      {isEmpty ? (
        <p className="text-sm text-neutral-400">
          尚無看板設定「開始日期欄位」與「天數欄位」,或此期間沒有任何人員分配。
        </p>
      ) : chartType === "bar" ? (
        <div className="space-y-2 rounded-md border border-neutral-200 bg-white p-4">
          {data.map((entry) => (
            <button
              key={entry.userId}
              type="button"
              onClick={() => toggleExpanded(entry.userId)}
              className="flex w-full items-center gap-3 rounded hover:bg-neutral-50"
            >
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
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-neutral-500">成員</span>
            <select
              value={selectedPieUserId ?? ""}
              onChange={(e) => setPieUserId(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
            >
              {data.map((entry) => (
                <option key={entry.userId} value={entry.userId}>
                  {entry.userName}
                </option>
              ))}
            </select>
          </div>
          {pieEntries.length === 0 ? (
            <p className="text-sm text-neutral-400">此成員在所選期間沒有任何指派中的任務。</p>
          ) : (
            <div className="flex flex-wrap items-center gap-6">
              <svg viewBox="0 0 120 120" width={140} height={140} className="shrink-0">
                {(() => {
                  let cumulative = 0;
                  const slices = pieFreePct > 0
                    ? [...pieEntries, { itemId: "__free__", avgPct: pieFreePct, free: true }]
                    : pieEntries;
                  return slices.map((entry, i) => {
                    const fraction = pieDenominator > 0 ? entry.avgPct / pieDenominator : 0;
                    const startAngle = cumulative * 2 * Math.PI;
                    cumulative += fraction;
                    const endAngle = cumulative * 2 * Math.PI;
                    const color = "free" in entry ? FREE_TIME_COLOR : PIE_COLORS[i % PIE_COLORS.length];
                    if (fraction >= 0.999) {
                      return <circle key={entry.itemId} cx={60} cy={60} r={55} fill={color} />;
                    }
                    return (
                      <path
                        key={entry.itemId}
                        d={pieSlicePath(60, 60, 55, startAngle, endAngle)}
                        fill={color}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="min-w-[240px] flex-1 space-y-1.5">
                {pieEntries.map((entry, i) => (
                  <div key={entry.itemId} className="flex items-center gap-2 px-1 py-0.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="shrink-0 text-xs text-neutral-400">{entry.boardName}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">
                      {entry.itemName}
                    </span>
                    <span className="shrink-0 text-sm text-neutral-500">{entry.avgPct}%</span>
                  </div>
                ))}
                {pieFreePct > 0 && (
                  <div className="flex items-center gap-2 px-1 py-0.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: FREE_TIME_COLOR }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-500">空閒時間</span>
                    <span className="shrink-0 text-sm text-neutral-500">{pieFreePct}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {chartType === "bar" && expandedUserId && (
        <div className="mt-2 overflow-hidden rounded-md border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">工作專案</th>
                <th className="px-3 py-1.5 text-left font-medium">工作事項</th>
                <th className="px-3 py-1.5 text-right font-medium">占比</th>
              </tr>
            </thead>
            <tbody>
              {(tasksByUser[expandedUserId] ?? []).map((t) => (
                <tr key={`${t.boardId}-${t.itemId}`} className="border-t border-neutral-100">
                  <td className="px-3 py-1.5 text-neutral-600">{t.boardName}</td>
                  <td className="px-3 py-1.5 text-neutral-800">{t.itemName}</td>
                  <td className="px-3 py-1.5 text-right text-neutral-600">{t.allocationPct}%</td>
                </tr>
              ))}
              {(tasksByUser[expandedUserId] ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-center text-neutral-400">
                    目前沒有指派中的任務
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
