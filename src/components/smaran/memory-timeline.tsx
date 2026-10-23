"use client";

import Link from "next/link";
import { Check, CalendarPlus, FilePlus2, BellPlus, PauseCircle, PlayCircle, Trash2, AlarmClockOff, Flag, Paperclip, UserPlus, PencilLine, CalendarCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppState, MemoryEvent } from "@/lib/types";
import { dateOf, formatLong, formatTime, relativeDay, timeOf } from "@/lib/dates";
import { memberById, todayOf } from "@/lib/selectors";

const ICONS: Record<MemoryEvent["type"], { icon: typeof Check; cls: string }> = {
  reminder_confirmed: { icon: Check, cls: "bg-confirmed text-white" },
  reminder_created: { icon: BellPlus, cls: "bg-peach-soft text-peach-deep" },
  reminder_updated: { icon: PencilLine, cls: "bg-ivory-deep text-brown" },
  reminder_snoozed: { icon: AlarmClockOff, cls: "bg-waiting-bg text-waiting" },
  reminder_paused: { icon: PauseCircle, cls: "bg-paused-bg text-paused" },
  reminder_resumed: { icon: PlayCircle, cls: "bg-ivory-deep text-brown" },
  reminder_deleted: { icon: Trash2, cls: "bg-paused-bg text-paused" },
  reminder_flagged: { icon: Flag, cls: "bg-missed-bg text-missed" },
  appointment_created: { icon: CalendarPlus, cls: "bg-sand text-brown" },
  appointment_updated: { icon: PencilLine, cls: "bg-ivory-deep text-brown" },
  appointment_completed: { icon: CalendarCheck2, cls: "bg-sand text-brown" },
  document_added: { icon: FilePlus2, cls: "bg-[#f1dcc4] text-[#a77a4c]" },
  document_linked: { icon: Paperclip, cls: "bg-ivory-deep text-brown" },
  member_added: { icon: UserPlus, cls: "bg-peach-soft text-peach-deep" },
};

function hrefFor(e: MemoryEvent): string | undefined {
  if (!e.refId) return undefined;
  if (e.type.startsWith("reminder") && e.type !== "reminder_deleted") return `/reminders/${e.refId}`;
  if (e.type.startsWith("appointment")) return `/appointments/${e.refId}`;
  if (e.type.startsWith("document")) return `/documents/${e.refId}`;
  if (e.type === "member_added") return `/family/${e.refId}`;
  return undefined;
}

export function MemoryTimeline({ state, events, showPerson = true, limit }: { state: AppState; events: MemoryEvent[]; showPerson?: boolean; limit?: number }) {
  const today = todayOf(state);
  const visible = (limit ? events.slice(0, limit) : events).filter((e) => e.timestamp <= state.demoNow || dateOf(e.timestamp) <= today);
  const groups = new Map<string, MemoryEvent[]>();
  for (const e of visible) {
    const key = dateOf(e.timestamp);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  return (
    <div className="space-y-7">
      {[...groups.entries()].map(([date, items]) => {
        const rel = relativeDay(date, today);
        return (
          <section key={date} aria-label={formatLong(date)}>
            <h3 className="mb-3 flex items-baseline gap-2 text-[15px] font-extrabold text-ink-strong">
              {formatLong(date).replace(/, \d{4}$/, "")}
              {(rel === "Today" || rel === "Yesterday") && <span className="text-[12px] font-bold text-ink-muted">{rel}</span>}
            </h3>
            <ol className="relative space-y-1 before:absolute before:top-3 before:bottom-3 before:left-[17px] before:w-px before:bg-line-strong">
              {items.map((e) => {
                const { icon: Icon, cls } = ICONS[e.type];
                const href = hrefFor(e);
                const member = memberById(state, e.familyMemberId);
                const body = (
                  <>
                    <span className={cn("relative z-10 flex size-[35px] shrink-0 items-center justify-center rounded-full ring-4 ring-ivory", cls)}>
                      <Icon className="size-4" strokeWidth={2.4} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5">
                      <span className="block text-[15.5px] font-bold text-ink-strong">{e.title}</span>
                      <span className="block text-[13.5px] text-ink-muted">
                        {showPerson && member ? `${member.name} · ` : ""}
                        {formatTime(timeOf(e.timestamp))}
                        {e.description ? ` · ${e.description}` : ""}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={e.id} className="animate-rise">
                    {href ? (
                      <Link href={href} className="flex gap-3.5 rounded-[16px] p-1.5 pr-3 hover:bg-surface/80">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex gap-3.5 p-1.5 pr-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
