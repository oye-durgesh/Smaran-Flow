"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { addCalendarMonths, formatMonthTitle, monthGrid } from "@/lib/timezone";
import type { DateKey } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthCalendar({
  month,
  today,
  selected,
  busy,
  onSelect,
  onMonthChange,
  onToday,
}: {
  month: string;
  today: DateKey;
  selected: DateKey;
  busy: Set<DateKey>;
  onSelect: (date: DateKey) => void;
  onMonthChange: (yearMonth: string) => void;
  onToday: () => void;
}) {
  const cells = monthGrid(month);
  return (
    <div data-testid="month-calendar" className="rounded-[22px] border border-line bg-surface-raised p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous month" onClick={() => onMonthChange(addCalendarMonths(month, -1))} className="inline-flex size-10 items-center justify-center rounded-[12px] text-ink hover:bg-ivory-deep">
            <ChevronLeft className="size-5" />
          </button>
          <h2 className="min-w-[9.5rem] text-center text-[16px] font-extrabold text-ink-strong">{formatMonthTitle(month)}</h2>
          <button type="button" aria-label="Next month" onClick={() => onMonthChange(addCalendarMonths(month, 1))} className="inline-flex size-10 items-center justify-center rounded-[12px] text-ink hover:bg-ivory-deep">
            <ChevronRight className="size-5" />
          </button>
        </div>
        <button type="button" onClick={onToday} className="h-10 rounded-full border border-line-strong bg-ivory px-3.5 text-[13px] font-bold text-ink hover:border-peach">
          Today
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-[11px] font-extrabold tracking-wide text-ink-muted uppercase">
            {d}
          </div>
        ))}
        {cells.map((cell) => {
          const isToday = cell.date === today;
          const isSelected = cell.date === selected;
          return (
            <button
              key={cell.date}
              type="button"
              data-date={cell.date}
              data-today={isToday || undefined}
              data-selected={isSelected || undefined}
              aria-current={isToday ? "date" : undefined}
              aria-pressed={isSelected}
              onClick={() => onSelect(cell.date)}
              className={cn(
                "relative mx-auto flex size-10 flex-col items-center justify-center rounded-full text-[14px] font-bold sm:size-11",
                !cell.inMonth && "text-ink-muted/40",
                cell.inMonth && !isSelected && "text-ink-strong hover:bg-ivory-deep",
                isToday && !isSelected && "ring-1 ring-peach-deep/70",
                isSelected && "bg-terracotta text-white",
              )}
            >
              {Number(cell.date.slice(8))}
              {busy.has(cell.date) && <span className={cn("absolute bottom-1 size-1 rounded-full", isSelected ? "bg-white" : "bg-peach-deep")} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

