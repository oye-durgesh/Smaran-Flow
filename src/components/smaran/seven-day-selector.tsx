"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, monthName, toDate, weekdayName, weekOf } from "@/lib/dates";
import type { DateKey } from "@/lib/types";

export function SevenDaySelector({
  selected,
  today,
  onSelect,
  busy,
  size = "md",
  className,
}: {
  selected: DateKey;
  today: DateKey;
  onSelect: (date: DateKey) => void;
  busy?: Set<DateKey>;
  size?: "md" | "lg";
  className?: string;
}) {
  const days = weekOf(selected);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, index: number) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = addDays(days[index], delta);
    onSelect(next);
    requestAnimationFrame(() => refs.current[(index + delta + 7) % 7]?.focus());
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-bold text-ink-muted">
          {monthName(days[0])} {toDate(days[0]).getFullYear()}
        </span>
        <div className="flex items-center gap-1">
          {selected !== today && (
            <button type="button" onClick={() => onSelect(today)} className="h-8 rounded-full px-3 text-[12px] font-bold text-peach-deep hover:bg-peach-soft/50">
              Today
            </button>
          )}
          <button type="button" aria-label="Previous week" onClick={() => onSelect(addDays(selected, -7))} className="inline-flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-ivory-deep">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Next week" onClick={() => onSelect(addDays(selected, 7))} className="inline-flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-ivory-deep">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div role="tablist" aria-label="Choose a day" className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const active = day === selected;
          const isToday = day === today;
          return (
            <button
              key={day}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              aria-label={`${weekdayName(day)} ${toDate(day).getDate()}${isToday ? ", today" : ""}`}
              onClick={() => onSelect(day)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "group relative flex flex-col items-center rounded-[18px] transition-all duration-300",
                size === "lg" ? "gap-1.5 py-3.5" : "gap-1 py-2.5",
                active ? "bg-peach text-ink-strong shadow-[0_6px_16px_-8px_rgb(201_128_95/0.7)]" : "text-ink hover:bg-ivory-deep",
              )}
            >
              <span className={cn("text-[11px] font-extrabold tracking-[0.1em] uppercase", active ? "text-ink-strong/80" : "text-ink-muted")}>{weekdayName(day, true)}</span>
              <span className={cn("font-extrabold", size === "lg" ? "text-[22px]" : "text-[19px]")}>{toDate(day).getDate()}</span>
              <span
                aria-hidden
                className={cn(
                  "size-1 rounded-full",
                  isToday && !active ? "bg-peach-deep" : busy?.has(day) ? (active ? "bg-ink-strong/50" : "bg-line-strong") : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
