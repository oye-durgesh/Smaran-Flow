"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The three-step "SMARAN is understanding you" sequence. It is paced for
 * legibility; parsing itself is instant and local.
 */
export function ProcessingState({
  steps,
  onDone,
  stepMs = 650,
  transcript,
  layout = "vertical",
}: {
  steps: string[];
  onDone: () => void;
  stepMs?: number;
  transcript?: string;
  layout?: "vertical" | "horizontal";
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? 120 : stepMs;
    if (active >= steps.length) {
      const t = window.setTimeout(onDone, reduced ? 50 : 300);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setActive((a) => a + 1), ms);
    return () => window.clearTimeout(t);
  }, [active, steps.length, stepMs, onDone]);

  return (
    <div className="animate-rise" role="status" aria-live="polite">
      {transcript && (
        <blockquote className="mb-6 rounded-[20px] border border-line bg-surface px-5 py-4 text-[17px] leading-relaxed font-semibold text-ink-strong">
          <span className="mb-1 block text-[11px] font-extrabold tracking-[0.18em] text-ink-muted uppercase">You said</span>“{transcript}”
        </blockquote>
      )}
      <ol className={cn(layout === "horizontal" ? "grid grid-cols-3 gap-3" : "space-y-3")}>
        {steps.map((step, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li
              key={step}
              className={cn(
                "flex items-center gap-4 rounded-[18px] border px-4 py-4 transition-all duration-500",
                layout === "horizontal" && "flex-col items-start gap-3",
                done ? "border-line bg-surface-raised" : current ? "border-peach bg-peach-soft/35" : "border-line bg-surface/50 opacity-60",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold transition-colors duration-300",
                  done ? "bg-confirmed text-white" : current ? "bg-peach text-ink-strong animate-breathe" : "bg-ivory-deep text-ink-muted",
                )}
              >
                {done ? <Check className="size-4 animate-pop" strokeWidth={3} /> : String(i + 1).padStart(2, "0")}
              </span>
              <span className={cn("text-[16px] font-bold", done || current ? "text-ink-strong" : "text-ink-muted")}>{step}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
