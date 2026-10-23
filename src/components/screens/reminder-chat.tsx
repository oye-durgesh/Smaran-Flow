"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BellRing, Check, IdCard, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { replyInConversation, startConversation } from "@/lib/store/actions";
import { confirmationOn, describeReminder, memberById, reminderStatusOn, todayOf } from "@/lib/selectors";
import { formatShort, formatTime, timeOf } from "@/lib/dates";
import { Screen } from "@/components/shell/screen";
import { ChatMessage, ConfirmationCard } from "@/components/smaran/chat";
import { WisprFlowInput } from "@/components/smaran/wispr-flow-input";
import { EmptyState, MemberAvatar, PageHeader, SectionLabel, StatusBadge, Surface } from "@/components/smaran/primitives";
import { SmaranMark } from "@/components/smaran/brand";
import { Button } from "@/components/ui/button";

const REPLIES = ["Medicine le li", "Thodi der mein", "Medicine khatam ho gayi"];
const CHECK_REPLIES = ["Check kar liya", "Thodi der mein"];

function TypingBubble() {
  return (
    <div className="flex items-end gap-2 animate-fade" aria-label="SMARAN is typing">
      <SmaranMark size={30} className="rounded-full" />
      <div className="flex gap-1 rounded-[22px] rounded-bl-[8px] border border-line bg-surface-raised px-4 py-4">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 animate-pulse rounded-full bg-ink-muted/60" style={{ animationDelay: `${i * 160}ms` }} />
        ))}
      </div>
    </div>
  );
}

export function ReminderChatScreen() {
  const { id } = useParams<{ id: string }>();
  const { state, commit } = useStore();
  const { isWeb } = useView();
  const endRef = useRef<HTMLDivElement>(null);
  const [holdId, setHoldId] = useState<string | null>(null);

  const reminder = state.reminders.find((r) => r.id === id);
  const today = todayOf(state);
  const conversation = state.conversations.find((c) => c.reminderId === id && c.date === today);
  const member = memberById(state, reminder?.familyMemberId);
  const confirmation = reminder ? confirmationOn(reminder, today) : undefined;
  const messages = conversation?.messages ?? [];
  const visible = holdId ? messages.slice(0, messages.findIndex((m) => m.id === holdId)) : messages;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [visible.length, holdId]);

  useEffect(() => {
    if (!holdId) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setHoldId(null), reduced ? 50 : 900);
    return () => window.clearTimeout(t);
  }, [holdId]);

  if (!reminder || !member) {
    return (
      <Screen width="narrow">
        <PageHeader back="/today" title="Reminder not found" />
        <EmptyState icon={<BellRing className="size-6" />} title="This reminder isn't here anymore." body="It may have been deleted. Your family memory still has its history." action={{ label: "Back to today", href: "/today" }} />
      </Screen>
    );
  }

  const send = (text: string) => {
    if (!conversation) return;
    const before = conversation.messages.length;
    commit((s) => replyInConversation(s, conversation.id, text));
    setHoldId(`pending-${before}`);
  };

  // Map the placeholder hold id onto the real SMARAN reply once state has it.
  if (holdId?.startsWith("pending-") && conversation) {
    const index = Number(holdId.slice(8)) + 1;
    const reply = conversation.messages[index];
    if (reply) setHoldId(reply.id);
  }

  const status = reminderStatusOn(reminder, today, state);
  const showConfirmation = confirmation && !holdId;
  const replies = reminder.kind === "medicine" ? REPLIES : CHECK_REPLIES;

  const header = (
    <div className="mb-5">
      <PageHeader
        back={`/reminders/${reminder.id}`}
        title={`${member.name}'s reminder`}
        subtitle={`${reminder.title} · ${formatTime(reminder.time)}`}
        className="mb-3"
        actions={!isWeb && <MemberAvatar member={member} size={42} />}
      />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sand/60 px-3 py-1 text-[12px] font-bold text-brown">
        This is the conversation {member.name} sees
      </span>
    </div>
  );

  const thread = conversation ? (
    <div className="space-y-4" aria-live="polite">
      {visible.map((m) => (
        <ChatMessage key={m.id} message={m} memberName={member.name} />
      ))}
      {holdId && <TypingBubble />}
      {showConfirmation && confirmation && (
        <div className="pt-2">
          <ConfirmationCard title={reminder.title} at={confirmation.confirmedAt} memberName={member.name} />
          <div className={cn("mt-4 grid gap-2.5", isWeb ? "grid-cols-2" : "grid-cols-1")}>
            <Link href="/family" className="flex h-12 items-center justify-center gap-2 rounded-[16px] bg-peach text-[15px] font-bold text-ink-strong hover:bg-[#e29c7e]">
              <Users className="size-4" aria-hidden /> See family dashboard
            </Link>
            <Link href={`/health-card/${member.id}`} className="flex h-12 items-center justify-center gap-2 rounded-[16px] border border-line-strong bg-surface-raised text-[15px] font-bold text-ink hover:bg-ivory-deep">
              <IdCard className="size-4" aria-hidden /> Open Health Card
            </Link>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  ) : confirmation ? (
    <ConfirmationCard title={reminder.title} at={confirmation.confirmedAt} memberName={member.name} />
  ) : (
    <Surface className="p-6 text-center">
      <SmaranMark size={48} className="mx-auto rounded-[14px]" />
      <p className="mt-4 text-[17px] font-bold text-ink-strong">This reminder goes out at {formatTime(reminder.time)}.</p>
      <p className="mt-1 text-[14.5px] text-ink-muted">Send it now so you can see the conversation {member?.name} would have.</p>
      <Button className="mt-5" size="lg" onClick={() => commit((s) => startConversation(s, reminder.id))} disabled={reminder.status === "paused"}>
        <BellRing className="size-4" aria-hidden /> {reminder.status === "paused" ? "Reminder is paused" : "Send reminder now"}
      </Button>
    </Surface>
  );

  const composer = conversation ? (
    <WisprFlowInput
      variant="composer"
      primary
      placeholder="Say anything..."
      examples={confirmation ? [] : replies}
      examplesAction="submit"
      onSubmit={send}
    />
  ) : undefined;

  const aside = isWeb ? (
    <>
      <div>
        <SectionLabel>What {state.user.name} sees</SectionLabel>
        <Surface className="p-4">
          <div className="flex items-center gap-3">
            <MemberAvatar member={member} size={40} />
            <div className="min-w-0 flex-1">
              <div className="text-[15.5px] font-bold text-ink-strong">{reminder.title}</div>
              <div className="text-[13px] text-ink-muted">
                {member.name} · {describeReminder(reminder)}
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-[14px] bg-ivory px-3 py-2.5">
            <span className="text-[13px] font-semibold text-ink-muted">Today</span>
            <StatusBadge status={status} label={confirmation ? `Confirmed ${formatTime(timeOf(confirmation.confirmedAt))}` : undefined} />
          </div>
        </Surface>
      </div>
      <div>
        <SectionLabel>Recent confirmations</SectionLabel>
        <ul className="space-y-2">
          {reminder.confirmationHistory.slice(0, 5).map((c) => (
            <li key={c.id} className="flex items-center gap-2.5 text-[14px]">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-confirmed text-white">
                <Check className="size-3" strokeWidth={3} aria-hidden />
              </span>
              <span className="font-bold text-ink-strong">{formatShort(c.date)}</span>
              <span className="text-ink-muted">· {formatTime(timeOf(c.confirmedAt))}</span>
            </li>
          ))}
          {reminder.confirmationHistory.length === 0 && <li className="text-[14px] text-ink-muted">No confirmations yet.</li>}
        </ul>
      </div>
      <p className="rounded-[16px] bg-sand/40 p-4 text-[13px] leading-relaxed text-ink">
        SMARAN only records what {member.name} says. If {member.name} mentions feeling unwell, SMARAN tells {state.user.name} — it never gives medical advice.
      </p>
    </>
  ) : undefined;

  return (
    <Screen width="narrow" aside={aside} footer={composer}>
      {header}
      {thread}
    </Screen>
  );
}
