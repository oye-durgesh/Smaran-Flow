"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, FileText, MapPin, Paperclip, Pill, Stethoscope, Activity, HeartPulse, ScanLine, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Appointment, FamilyMember, HealthDocument } from "@/lib/types";
import type { AgendaItem } from "@/lib/selectors";
import { formatShort, formatTime, relativeDay, timeOf } from "@/lib/dates";
import { describeReminder } from "@/lib/selectors";
import { MemberAvatar, StatusBadge, statusBarClass, Surface } from "./primitives";

/* ---------- Agenda / reminder card ---------- */

const KIND_ICON = { medicine: Pill, check: HeartPulse, other: Activity } as const;

export function AgendaCard({ item, today, onSend, compact }: { item: AgendaItem; today: string; onSend?: (reminderId: string) => void; compact?: boolean }) {
  if (item.kind === "appointment") {
    const a = item.appointment;
    return (
      <Link href={`/appointments/${a.id}`} className="group block focus-visible:outline-offset-4">
        <Surface className="@container relative flex items-center gap-4 overflow-hidden p-4 pl-5 transition-colors group-hover:border-line-strong">
          <span aria-hidden className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full", statusBarClass(a.status === "completed" ? "completed" : "upcoming"))} />
          <TimeColumn time={item.time} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[16px] font-bold text-ink-strong">
              <Stethoscope className="size-4 text-terracotta" aria-hidden /> Doctor appointment
            </div>
            <div className="mt-0.5 truncate text-[14px] text-ink-muted">
              {item.member?.name} · {a.doctor}
            </div>
          </div>
          <StatusBadge status={a.status === "completed" ? "completed" : "upcoming"} className={COMPACT_BADGE} />
        </Surface>
      </Link>
    );
  }

  const r = item.reminder;
  const Icon = KIND_ICON[r.kind];
  const canSend = onSend && item.status === "waiting";
  return (
    <Surface className="@container relative overflow-hidden transition-colors hover:border-line-strong">
      <span aria-hidden className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full", statusBarClass(item.status))} />
      <Link href={`/reminders/${r.id}`} className="flex items-center gap-4 p-4 pl-5 focus-visible:outline-offset-[-4px]">
        <TimeColumn time={item.time} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[16px] font-bold text-ink-strong">
            <Icon className="size-4 text-peach-deep" aria-hidden /> {r.title}
          </div>
          <div className="mt-0.5 truncate text-[14px] text-ink-muted">
            {item.member?.name}
            {item.confirmation && ` · replied ${formatTime(timeOf(item.confirmation.confirmedAt))}`}
          </div>
        </div>
        <StatusBadge status={item.status} className={COMPACT_BADGE} />
      </Link>
      {canSend && !compact && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-2.5">
          <span className="text-[12.5px] text-ink-muted">{relativeDay(today, today)} · reminder goes out at {formatTime(r.time)}</span>
          <button type="button" onClick={() => onSend(r.id)} className="inline-flex h-8 items-center gap-1 rounded-full bg-peach-soft/60 px-3 text-[12.5px] font-bold text-ink-strong transition-colors hover:bg-peach-soft">
            Send now <ChevronRight className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
    </Surface>
  );
}

/** Phone-width cards show the badge icon only; the label stays for screen readers. */
const COMPACT_BADGE = "@max-[380px]:size-7 @max-[380px]:justify-center @max-[380px]:p-0 @max-[380px]:[&_.badge-label]:sr-only";

function TimeColumn({ time }: { time: string }) {
  const [clock, suffix] = formatTime(time).split(" ");
  return (
    <div className="w-[58px] shrink-0 text-left">
      <div className="text-[17px] leading-none font-extrabold text-ink-strong">{clock}</div>
      <div className="mt-1 text-[11px] font-bold tracking-wider text-ink-muted">{suffix}</div>
    </div>
  );
}

/* ---------- Appointment card ---------- */

export function AppointmentCard({ appointment, member, today }: { appointment: Appointment; member?: FamilyMember; today: string }) {
  const done = appointment.status === "completed" || appointment.date < today;
  return (
    <Link href={`/appointments/${appointment.id}`} className="group block">
      <Surface className="@container relative flex items-center gap-4 overflow-hidden p-4 pl-5 transition-colors group-hover:border-line-strong">
        <span aria-hidden className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full", statusBarClass(done ? "completed" : "upcoming"))} />
        <div className={cn("flex size-12 shrink-0 flex-col items-center justify-center rounded-[14px]", done ? "bg-paused-bg text-brown" : "bg-sand/70 text-ink-strong")}>
          <span className="text-[10px] font-extrabold tracking-wider uppercase">{formatShort(appointment.date).split(" ")[0]}</span>
          <span className="text-[17px] leading-none font-extrabold">{formatShort(appointment.date).split(" ")[1]}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold text-ink-strong">{appointment.doctor}</div>
          <div className="mt-0.5 truncate text-[14px] text-ink-muted">
            {member?.name} · {relativeDay(appointment.date, today)} · {formatTime(appointment.time)}
          </div>
          {appointment.documentIds.length > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brown">
              <Paperclip className="size-3.5" aria-hidden /> {appointment.documentIds.length} document{appointment.documentIds.length === 1 ? "" : "s"}
            </div>
          )}
        </div>
        <StatusBadge status={done ? "completed" : "upcoming"} />
      </Surface>
    </Link>
  );
}

/* ---------- Document card ---------- */

export const DOC_ICON = { report: ClipboardList, prescription: FileText, scan: ScanLine, note: FileText, other: FileText } as const;
export const DOC_TYPE_LABEL = { report: "Report", prescription: "Prescription", scan: "Scan", note: "Note", other: "Other" } as const;

export function DocumentCard({ doc, member, compact }: { doc: HealthDocument; member?: FamilyMember; compact?: boolean }) {
  const Icon = DOC_ICON[doc.type];
  return (
    <Link href={`/documents/${doc.id}`} className="group block h-full">
      <Surface className={cn("flex h-full items-center gap-3.5 transition-colors group-hover:border-line-strong", compact ? "p-3" : "p-4")}>
        <div className={cn("flex shrink-0 items-center justify-center rounded-[14px] bg-peach-soft/60 text-peach-deep", compact ? "size-10" : "size-12")}>
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15.5px] font-bold text-ink-strong">{doc.name}</div>
          <div className="mt-0.5 truncate text-[13.5px] text-ink-muted">
            {member?.name} · {formatShort(doc.date)}
          </div>
        </div>
        {!compact && <span className="rounded-full bg-ivory-deep px-2.5 py-1 text-[11.5px] font-bold text-brown">{DOC_TYPE_LABEL[doc.type]}</span>}
      </Surface>
    </Link>
  );
}

/* ---------- Family member card ---------- */

export function FamilyMemberCard({
  member,
  summary,
  nextAppointment,
  today,
}: {
  member: FamilyMember;
  summary: { total: number; confirmed: number; waiting: number; missed: number; agenda: AgendaItem[] };
  nextAppointment?: Appointment;
  today: string;
}) {
  return (
    <Surface className="overflow-hidden">
      <Link href={`/family/${member.id}`} className="flex items-center gap-4 p-5 pb-4 hover:bg-surface/60">
        <MemberAvatar member={member} size={52} />
        <div className="min-w-0 flex-1">
          <div className="text-[20px] font-extrabold text-ink-strong">{member.name}</div>
          <div className="text-[14px] text-ink-muted">
            {member.relationship}
            {member.age ? ` · ${member.age}` : ""}
          </div>
        </div>
        <ChevronRight className="size-5 text-ink-muted" aria-hidden />
      </Link>
      <div className="px-5 pb-5">
        <div className="mb-3 flex flex-wrap gap-2 text-[12.5px] font-bold">
          <span className="rounded-full bg-ivory-deep px-2.5 py-1 text-ink">{summary.total} reminder{summary.total === 1 ? "" : "s"} today</span>
          {summary.confirmed > 0 && <span className="rounded-full bg-confirmed-bg px-2.5 py-1 text-confirmed">{summary.confirmed} confirmed</span>}
          {summary.waiting > 0 && <span className="rounded-full bg-waiting-bg px-2.5 py-1 text-waiting">{summary.waiting} waiting</span>}
        </div>
        <ul className="space-y-2">
          {summary.agenda.map((item) => (
            <li key={item.id} className="flex items-center gap-3 text-[15px]">
              {item.kind === "reminder" ? (
                <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full", item.status === "confirmed" ? "bg-confirmed text-white" : "border-2 border-line-strong")}>
                  {item.status === "confirmed" && <span className="text-[11px] font-black">✓</span>}
                </span>
              ) : (
                <CalendarDays className="size-5 shrink-0 text-terracotta" aria-hidden />
              )}
              <span className={cn("flex-1 truncate", item.status === "confirmed" ? "text-ink" : "font-semibold text-ink-strong")}>
                {item.kind === "reminder" ? item.reminder.title : `${item.appointment.doctor} appointment`}
              </span>
              <span className="text-[13px] text-ink-muted">{formatTime(item.time)}</span>
            </li>
          ))}
          {summary.agenda.length === 0 && <li className="text-[14px] text-ink-muted">Nothing scheduled for today.</li>}
        </ul>
        {nextAppointment && (
          <Link href={`/appointments/${nextAppointment.id}`} className="mt-4 flex items-center gap-2 rounded-[14px] bg-sand/50 px-3 py-2.5 text-[13.5px] text-ink hover:bg-sand/80">
            <MapPin className="size-4 text-brown" aria-hidden />
            <span className="truncate">
              Next: <b>{nextAppointment.doctor}</b> · {relativeDay(nextAppointment.date, today)} · {formatTime(nextAppointment.time)}
            </span>
          </Link>
        )}
      </div>
    </Surface>
  );
}

export function ReminderRow({ reminder, member, href }: { reminder: { id: string; title: string; kind: keyof typeof KIND_ICON; time: string; frequency: "daily" | "weekly" | "once"; weekday?: number; date?: string; status: "active" | "paused" }; member?: FamilyMember; href?: string }) {
  const Icon = KIND_ICON[reminder.kind];
  return (
    <Link href={href ?? `/reminders/${reminder.id}`} className="flex items-center gap-3 rounded-[16px] px-1 py-2.5 hover:bg-ivory-deep/60">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-peach-soft/60 text-peach-deep">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15.5px] font-bold text-ink-strong">{reminder.title}</span>
        <span className="block truncate text-[13.5px] text-ink-muted">
          {member ? `${member.name} · ` : ""}
          {describeReminder(reminder)}
        </span>
      </span>
      {reminder.status === "paused" && <StatusBadge status="paused" />}
    </Link>
  );
}
