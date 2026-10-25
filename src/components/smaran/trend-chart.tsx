"use client";

import { useState } from "react";
import type { ChartPoint } from "@/lib/health-record-model";

export function TrendChart({
  title,
  help,
  seriesA,
  seriesB,
  labelA,
  labelB,
  unit,
  empty,
}: {
  title: string;
  help?: string;
  seriesA: ChartPoint[];
  seriesB?: ChartPoint[];
  labelA: string;
  labelB?: string;
  unit: string;
  empty: string;
}) {
  const [tip, setTip] = useState<string | null>(null);
  const points = seriesA;
  if (points.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-line-strong bg-surface/60 px-4 py-8 text-center text-[14px] text-ink-muted">
        <p className="font-bold text-ink-strong">{title}</p>
        <p className="mt-2">{empty}</p>
      </div>
    );
  }
  const values = [...points.map((p) => p.value), ...(seriesB ?? []).map((p) => p.value)];
  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  const w = 320;
  const h = 140;
  const path = (rows: ChartPoint[]) =>
    rows
      .map((p, i) => {
        const x = 20 + (i * (w - 40)) / Math.max(rows.length - 1, 1);
        const y = 16 + ((max - p.value) / Math.max(max - min, 1)) * (h - 32);
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  return (
    <figure className="min-w-0 rounded-[18px] border border-line bg-surface-raised p-4">
      <figcaption className="text-[15px] font-extrabold text-ink-strong">{title}</figcaption>
      {help && <p className="mt-1 text-[12.5px] text-ink-muted">{help}</p>}
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-40 w-full" role="img" aria-label={title}>
        <path d={path(points)} fill="none" stroke="#E58F7D" strokeWidth="2" />
        {seriesB && <path d={path(seriesB)} fill="none" stroke="#C8944F" strokeWidth="2" />}
        {points.map((p, i) => {
          const x = 20 + (i * (w - 40)) / Math.max(points.length - 1, 1);
          const y = 16 + ((max - p.value) / Math.max(max - min, 1)) * (h - 32);
          return (
            <circle
              key={p.id}
              cx={x}
              cy={y}
              r="4"
              fill="#8F4538"
              tabIndex={0}
              onFocus={() => setTip(`${p.label}: ${p.value}${p.extra != null ? `/${p.extra}` : ""} ${p.unit}${p.context ? ` · ${p.context}` : ""}`)}
              onMouseEnter={() => setTip(`${p.label}: ${p.value}${p.extra != null ? `/${p.extra}` : ""} ${p.unit}${p.context ? ` · ${p.context}` : ""}`)}
            />
          );
        })}
      </svg>
      <p className="mt-1 text-[12px] text-ink-muted">
        <span className="font-bold text-[#8F4538]">{labelA}</span>
        {labelB && <> · <span className="font-bold text-[#80551F]">{labelB}</span></>}
        {" "}· {unit}. Gaps mean no saved reading. Sample notes are excluded.
      </p>
      {tip && <p className="mt-1 text-[13px] font-semibold text-ink">{tip}</p>}
    </figure>
  );
}
