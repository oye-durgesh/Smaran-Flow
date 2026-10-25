"use client";

import { Check, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { addCalendarWeeks, formatMonthTitle, formatWeekRange, mondayWeekOf, yearMonthOf } from "@/lib/timezone";
import { dayCareProgress, progressLabel, type DayCareProgress } from "@/lib/day-progress";
import type { AppState, DateKey } from "@/lib/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const R = 16;
const C = 2 * Math.PI * R;

function Ring({ progress, selected }: { progress: DayCareProgress; selected: boolean }) {
  const green = progress.tone === "complete" ? 1 : progress.eligibleTaskCount === 0 ? 0 : progress.completedCount / progress.eligibleTaskCount;
  const greenLen = C * Math.max(0, Math.min(1, green));
  const rest = C - greenLen;
  const track =
    progress.tone === "neutral"
      ? selected
        ? "stroke-white/35"
        : "stroke-line"
      : progress.tone === "missed" && progress.completedCount === 0
        ? "stroke-missed"
        : "stroke-[#d4a373]";
  const completeStroke = progress.tone === "complete" || progress.completedCount > 0 ? "stroke-[#3d8b5c]" : track;
  return (
    <svg viewBox="0 0 40 40" className="absolute inset-0 size-full -rotate-90" aria-hidden>
      <circle cx="20" cy="20" r={R} fill="none" className={track} strokeWidth="2.25" />
      {greenLen > 0 && (
        <circle
          cx="20"
          cy="20"
          r={R}
          fill="none"
          className={completeStroke}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeDasharray={`${greenLen} ${rest}`}
        />
      )}
    </svg>
  );
}

export function WeekProgressCalendar({
  weekStart,
  today,
  selected,
  state,
  onSelect,
  onWeekChange,
  onToday,
}: {
  weekStart: DateKey;
  today: DateKey;
  selected: DateKey;
  state: AppState;
  onSelect: (date: DateKey) => void;
  onWeekChange: (monday: DateKey) => void;
  onToday: () => void;
}) {
  const days = mondayWeekOf(weekStart);
  const monday = days[0];
  const range = formatWeekRange(days);
  const monthTitle = formatMonthTitle(yearMonthOf(selected));

  return (
    <div data-testid="week-calendar" className="overflow-x-hidden rounded-[22px] border border-line bg-surface-raised p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-0.5">
          <button type="button" aria-label="Previous week" onClick={() => onWeekChange(addCalendarWeeks(monday, -1))} className="inline-flex size-10 items-center justify-center rounded-[12px] text-ink hover:bg-ivory-deep">
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 px-1 text-center">
            <h2 className="truncate text-[15px] font-extrabold text-ink-strong">{monthTitle}</h2>
            <p className="truncate text-[12px] font-semibold text-ink-muted">{range}</p>
          </div>
          <button type="button" aria-label="Next week" onClick={() => onWeekChange(addCalendarWeeks(monday, 1))} className="inline-flex size-10 items-center justify-center rounded-[12px] text-ink hover:bg-ivory-deep">
            <ChevronRight className="size-5" />
          </button>
        </div>
        <button type="button" onClick={onToday} className="h-10 rounded-full border border-line-strong bg-ivory px-3.5 text-[13px] font-bold text-ink hover:border-peach">
          Today
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {days.map((date, i) => {
          const progress = dayCareProgress(state, date);
          const isToday = date === today;
          const isSelected = date === selected;
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              data-today={isToday || undefined}
              data-selected={isSelected || undefined}
              data-tone={progress.tone}
              aria-current={isToday ? "date" : undefined}
              aria-pressed={isSelected}
              aria-label={progressLabel(progress)}
              onClick={() => onSelect(date)}
              className="flex min-w-0 flex-col items-center gap-1 rounded-[14px] px-0.5 py-1 hover:bg-ivory-deep"
            >
              <span className="text-[10px] font-extrabold tracking-wide text-ink-muted uppercase sm:text-[11px]">{WEEKDAYS[i]}</span>
              <span className="relative flex size-10 items-center justify-center sm:size-11">
                <Ring progress={progress} selected={isSelected} />
                <span
                  className={cn(
                    "relative z-[1] flex size-7 items-center justify-center rounded-full text-[13px] font-extrabold sm:size-8 sm:text-[14px]",
                    isSelected && "bg-terracotta text-white",
                    !isSelected && isToday && "text-peach-deep",
                    !isSelected && !isToday && "text-ink-strong",
                  )}
                >
                  {Number(date.slice(8))}
                </span>
              </span>
              <span className="flex h-3 items-center justify-center">
                {progress.tone === "complete" && <Check className="size-3 text-[#3d8b5c]" aria-hidden />}
                {progress.tone === "missed" && <TriangleAlert className="size-3 text-missed" aria-hidden />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
