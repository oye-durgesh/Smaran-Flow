"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { memberById } from "@/lib/selectors";
import { formatTime } from "@/lib/dates";
import { openingMessage } from "@/lib/nlu/chat";
import { SmaranMark } from "@/components/smaran/brand";
import { useOpenReminderChat } from "./use-send-reminder";

export function IncomingReminderBanner({ placement }: { placement: "phone" | "desktop" }) {
  const state = useAppState();
  const { incomingReminderId, setIncomingReminderId } = useView();
  const open = useOpenReminderChat();
  const reminder = state.reminders.find((r) => r.id === incomingReminderId);
  if (!reminder) return null;
  const member = memberById(state, reminder.familyMemberId);

  return (
    <div
      role="alert"
      className={cn(
        "z-40 animate-slide-down",
        placement === "phone" ? "absolute inset-x-3 top-11" : "fixed top-[68px] right-6 w-[380px]",
      )}
    >
      <div className="rounded-[22px] border border-line bg-surface-raised p-3.5 shadow-[var(--shadow-raised)]">
        <div className="flex items-start gap-3">
          <SmaranMark size={38} className="rounded-[12px]" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-[11.5px] font-bold text-ink-muted">
              <span>SMARAN · on {member?.name}&apos;s phone</span>
              <span>{formatTime(reminder.time)}</span>
            </div>
            <p className="mt-0.5 text-[15px] leading-snug font-bold text-ink-strong">{openingMessage(member?.name ?? "", reminder.title, reminder.kind)}</p>
            <p className="text-[12.5px] text-ink-muted">
              {reminder.title} · {formatTime(reminder.time)}
            </p>
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => setIncomingReminderId(null)} className="-mt-1 -mr-1 inline-flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-ivory-deep">
            <X className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => open(reminder.id, { demo: true })}
          className="mt-3 flex h-10 w-full items-center justify-center rounded-[14px] bg-peach text-[14.5px] font-bold text-ink-strong transition-colors hover:bg-[#e29c7e]"
          autoFocus
        >
          Open reminder
        </button>
      </div>
    </div>
  );
}
