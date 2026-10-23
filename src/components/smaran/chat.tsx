"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage as Message } from "@/lib/types";
import { formatLong, formatTime, dateOf, timeOf } from "@/lib/dates";
import { SmaranMark } from "./brand";

export function ChatMessage({ message, memberName }: { message: Message; memberName: string }) {
  if (message.from === "system") {
    return (
      <div className="flex justify-center py-1 animate-fade">
        <span className="rounded-full bg-ivory-deep px-3 py-1 text-[12px] font-semibold text-ink-muted">{message.text}</span>
      </div>
    );
  }
  const mine = message.from === "member";
  return (
    <div className={cn("flex items-end gap-2 animate-rise", mine ? "justify-end" : "justify-start")}>
      {!mine && <SmaranMark size={30} className="mb-5 rounded-full" />}
      <div className={cn("max-w-[78%]", mine && "items-end text-right")}>
        <div
          className={cn(
            "rounded-[22px] px-4 py-3 text-left text-[17px] leading-snug font-semibold",
            mine ? "rounded-br-[8px] bg-peach text-ink-strong" : "rounded-bl-[8px] border border-line bg-surface-raised text-ink-strong",
          )}
        >
          {message.text}
        </div>
        <div className={cn("mt-1 px-1 text-[11.5px] text-ink-muted", mine ? "text-right" : "text-left")}>
          {mine ? memberName : "SMARAN"} · {formatTime(timeOf(message.at))}
        </div>
      </div>
    </div>
  );
}

export function ConfirmationCard({ title, at, memberName, className }: { title: string; at: string; memberName: string; className?: string }) {
  return (
    <div className={cn("rounded-[24px] border border-line bg-surface-raised p-6 text-center shadow-[var(--shadow-raised)] animate-rise", className)} role="status">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-confirmed text-white animate-pop">
        <Check className="size-8" strokeWidth={3} aria-hidden />
      </span>
      <div className="mt-4 text-[22px] font-extrabold text-ink-strong">{title}</div>
      <div className="mt-1 text-[16px] font-bold text-confirmed">Confirmed at {formatTime(timeOf(at))}</div>
      <div className="mt-0.5 text-[14px] text-ink-muted">{formatLong(dateOf(at))}</div>
      <div className="mt-4 inline-flex rounded-full bg-sand/60 px-4 py-1.5 text-[14px] font-bold text-ink">{memberName} is all set.</div>
    </div>
  );
}
