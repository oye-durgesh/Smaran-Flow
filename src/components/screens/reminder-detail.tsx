"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, Check, MessageCircle, Pause, Pencil, Play, Pill, Trash2, HeartPulse, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { confirmManually, deleteReminder, setReminderPaused, updateReminder } from "@/lib/store/actions";
import { confirmationOn, describeReminder, frequencyLabel, memberById, nextOccurrence, reminderOccursOn, reminderStatusOn, todayOf } from "@/lib/selectors";
import { dateOf, formatLong, formatShort, formatTime, relativeDay, timeOf, weekOf, weekdayName, toDate } from "@/lib/dates";
import { Screen } from "@/components/shell/screen";
import { useSendReminderNow } from "@/components/shell/use-send-reminder";
import { DetailRow, EmptyState, MemberAvatar, PageHeader, SectionLabel, StatusBadge, Surface } from "@/components/smaran/primitives";
import { ReminderDraftEditor } from "@/components/smaran/understood";
import { Modal } from "@/components/smaran/modal";
import { Button } from "@/components/ui/button";
import type { ReminderDraft } from "@/lib/nlu";

const ICON = { medicine: Pill, check: HeartPulse, other: Activity };

export function ReminderDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, update } = useStore();
  const { isWeb } = useView();
  const sendNow = useSendReminderNow();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const reminder = state.reminders.find((r) => r.id === id);
  if (!reminder) {
    return (
      <Screen width="narrow">
        <PageHeader back="/today" title="Reminder" />
        <EmptyState icon={<BellRing className="size-6" />} title="This reminder isn't here anymore." body="It may have been deleted. Tell SMARAN if you'd like to set it up again." action={{ label: "Add reminder", href: "/new?kind=reminder" }} />
      </Screen>
    );
  }

  const member = memberById(state, reminder.familyMemberId);
  const today = todayOf(state);
  const status = reminderStatusOn(reminder, today, state);
  const next = nextOccurrence(reminder, state);
  const conversation = state.conversations.find((c) => c.reminderId === reminder.id && c.date === today);
  const Icon = ICON[reminder.kind];
  const todayConfirmed = confirmationOn(reminder, today);
  const occursToday = reminderOccursOn(reminder, today);

  const draft: ReminderDraft = { transcript: "", memberId: reminder.familyMemberId, title: reminder.title, kind: reminder.kind, time: reminder.time, frequency: reminder.frequency, date: reminder.date, weekday: reminder.weekday, assumptions: [] };

  const week = weekOf(today).map((d) => ({ date: d, occurs: reminderOccursOn(reminder, d), status: reminderStatusOn(reminder, d, state), confirmation: confirmationOn(reminder, d) }));

  const summary = (
    <Surface className="p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-peach-soft/70 text-peach-deep">
          <Icon className="size-7" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[24px] leading-tight font-extrabold text-ink-strong">{reminder.title}</div>
          <Link href={`/family/${member?.id}`} className="mt-1 inline-flex items-center gap-2 text-[15px] font-semibold text-ink-muted hover:text-ink">
            <MemberAvatar member={member} size={22} /> {member?.name}
          </Link>
        </div>
        {occursToday && <StatusBadge status={status} />}
      </div>
      <dl className="mt-5 divide-y divide-line border-t border-line">
        <DetailRow label="Time">{formatTime(reminder.time)}</DetailRow>
        <DetailRow label="Frequency">{reminder.frequency === "once" && reminder.date ? `Once · ${formatShort(reminder.date)}` : frequencyLabel(reminder)}</DetailRow>
        <DetailRow label="Next reminder">{reminder.status === "paused" ? "Paused" : next ? `${relativeDay(next, today)} · ${formatTime(reminder.time)}` : "—"}</DetailRow>
        <DetailRow label="Created">{formatLong(dateOf(reminder.createdAt))}{reminder.source === "wispr" ? " · via Wispr Flow" : ""}</DetailRow>
      </dl>
    </Surface>
  );

  const weekStrip = (
    <section>
      <SectionLabel>This week</SectionLabel>
      <div className="grid grid-cols-7 gap-1.5">
        {week.map((d) => (
          <div key={d.date} className={cn("flex flex-col items-center gap-1.5 rounded-[14px] py-2.5", d.date === today ? "bg-peach-soft/50" : "bg-surface")}>
            <span className="text-[10.5px] font-extrabold tracking-wider text-ink-muted uppercase">{weekdayName(d.date, true)}</span>
            <span className="text-[14px] font-extrabold text-ink-strong">{toDate(d.date).getDate()}</span>
            <span
              aria-label={d.occurs ? d.status : "no reminder"}
              className={cn(
                "flex size-5 items-center justify-center rounded-full",
                !d.occurs && "bg-transparent",
                d.occurs && d.status === "confirmed" && "bg-confirmed text-white",
                d.occurs && d.status === "missed" && "border-2 border-missed/60",
                d.occurs && (d.status === "waiting" || d.status === "upcoming") && "border-2 border-line-strong",
                d.occurs && d.status === "paused" && "bg-paused-bg",
              )}
            >
              {d.occurs && d.status === "confirmed" && <Check className="size-3" strokeWidth={3.2} />}
            </span>
          </div>
        ))}
      </div>
    </section>
  );

  const history = (
    <section>
      <SectionLabel>Recent confirmations</SectionLabel>
      {reminder.confirmationHistory.length ? (
        <Surface as="section" className="divide-y divide-line px-4">
          {[...reminder.confirmationHistory]
            .sort((a, b) => (a.confirmedAt < b.confirmedAt ? 1 : -1))
            .slice(0, 7)
            .map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-confirmed text-white">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                </span>
                <span className="flex-1 text-[15px] font-bold text-ink-strong">
                  {formatShort(c.date)} · {formatTime(timeOf(c.confirmedAt))}
                </span>
                <span className="truncate text-[13px] text-ink-muted">{c.source === "chat" ? `“${c.response}”` : "Marked by family"}</span>
              </div>
            ))}
        </Surface>
      ) : (
        <p className="rounded-[16px] bg-surface px-4 py-4 text-[14.5px] text-ink-muted">No confirmations yet. They&apos;ll appear here when {member?.name} replies.</p>
      )}
    </section>
  );

  const primary = (
    <div className="space-y-2.5">
      {conversation ? (
        <Link href={`/reminders/${reminder.id}/chat`} className="flex h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-peach text-[15.5px] font-bold text-ink-strong hover:bg-[#e29c7e]">
          <MessageCircle className="size-4" aria-hidden /> Open today&apos;s conversation
        </Link>
      ) : (
        occursToday &&
        !todayConfirmed &&
        reminder.status === "active" && (
          <Button size="lg" className="w-full" onClick={() => sendNow(reminder.id)}>
            <BellRing className="size-4" aria-hidden /> Trigger demo reminder
          </Button>
        )
      )}
      {occursToday && !todayConfirmed && reminder.status === "active" && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            update((s) => confirmManually(s, reminder.id));
            toast.success(`${reminder.title} marked as done`, { description: `Recorded for ${member?.name} at ${formatTime(timeOf(state.demoNow))}.` });
          }}
        >
          <Check className="size-4" aria-hidden /> Mark done for today
        </Button>
      )}
    </div>
  );

  const actions = (
    <div className="grid grid-cols-3 gap-2">
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="size-4" aria-hidden /> Edit
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          const pausing = reminder.status === "active";
          update((s) => setReminderPaused(s, reminder.id, pausing));
          toast(pausing ? `${reminder.title} paused` : `${reminder.title} resumed`, { description: pausing ? `${member?.name} won't be reminded until you resume.` : `Next reminder at ${formatTime(reminder.time)}.` });
        }}
      >
        {reminder.status === "active" ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        {reminder.status === "active" ? "Pause" : "Resume"}
      </Button>
      <Button variant="destructive" onClick={() => setDeleting(true)}>
        <Trash2 className="size-4" aria-hidden /> Delete
      </Button>
    </div>
  );

  const dialogs = (
    <>
      <ReminderDraftEditor
        open={editing}
        onOpenChange={setEditing}
        draft={draft}
        family={state.family}
        onSave={(d) => {
          update((s) => updateReminder(s, reminder.id, { title: d.title, time: d.time, frequency: d.frequency, familyMemberId: d.memberId, date: d.date, weekday: d.weekday }));
          toast.success("Reminder updated", { description: describeReminder({ ...reminder, time: d.time!, frequency: d.frequency, date: d.date, weekday: d.weekday }) });
        }}
      />
      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${reminder.title}?`}
        description={`${member?.name} won't get this reminder anymore. Past confirmations stay in your family memory.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(false)}>Keep it</Button>
            <Button
              variant="destructive"
              onClick={() => {
                update((s) => deleteReminder(s, reminder.id));
                setDeleting(false);
                toast(`${reminder.title} deleted`);
                router.push("/today");
              }}
            >
              Delete reminder
            </Button>
          </>
        }
      />
    </>
  );

  if (isWeb) {
    return (
      <Screen
        aside={
          <>
            <div>
              <SectionLabel>Reminder</SectionLabel>
              {primary}
            </div>
            <div>
              <SectionLabel>Manage</SectionLabel>
              {actions}
            </div>
            {weekStrip}
          </>
        }
      >
        <PageHeader back="/today" eyebrow={`${member?.name}'s reminder`} title={reminder.title} subtitle={describeReminder(reminder)} />
        <div className="space-y-8">
          {summary}
          {history}
        </div>
        {dialogs}
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader back="/today" eyebrow={`${member?.name}'s reminder`} title={reminder.title} />
      <div className="space-y-6">
        {summary}
        {primary}
        {weekStrip}
        {history}
        {actions}
      </div>
      {dialogs}
    </Screen>
  );
}
