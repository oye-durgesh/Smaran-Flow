"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, CalendarX2, Check, CheckCircle2, MapPin, Paperclip, Pencil, Plus, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { addAppointmentReminder, linkDocument, setAppointmentStatus, toggleAppointmentReminder, updateAppointment } from "@/lib/store/actions";
import { completedAppointments, documentsFor, memberById, todayOf, upcomingAppointments } from "@/lib/selectors";
import { addDays, addMinutes, dateOf, formatDayLong, formatDayShort, formatOffset, formatShort, formatTime, stamp, timeOf, weekOf } from "@/lib/dates";
import type { AppointmentDraft } from "@/lib/nlu";
import { Screen } from "@/components/shell/screen";
import { AppointmentCard, DOC_ICON } from "@/components/smaran/cards";
import { DetailRow, EmptyState, MemberAvatar, PageHeader, SectionLabel, StatusBadge, Surface } from "@/components/smaran/primitives";
import { SevenDaySelector } from "@/components/smaran/seven-day-selector";
import { SmaranSpeakBox } from "@/components/smaran/smaran-speak-box";
import { AppointmentDraftEditor } from "@/components/smaran/understood";
import { Modal } from "@/components/smaran/modal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function AppointmentsScreen() {
  const { state, update } = useStore();
  const { isWeb } = useView();
  const today = todayOf(state);
  const selected = state.selectedDate;
  const upcoming = upcomingAppointments(state);
  const completed = completedAppointments(state);
  const week = weekOf(selected);
  const busy = new Set(state.appointments.filter((a) => week.includes(a.date)).map((a) => a.date));
  const onDay = state.appointments.filter((a) => a.date === selected).sort((a, b) => (a.time < b.time ? -1 : 1));
  const weekEnd = addDays(week[0], 6);
  const thisWeek = upcoming.filter((a) => a.date <= weekEnd);
  const later = upcoming.filter((a) => a.date > weekEnd);

  const wispr = <SmaranSpeakBox context="appointments" placeholder="Tell SMARAN about an appointment…" />;

  const list = (title: string, items: typeof upcoming) =>
    items.length > 0 && (
      <section>
        <SectionLabel>{title}</SectionLabel>
        <ul className={cn(isWeb ? "grid grid-cols-2 gap-3" : "space-y-3", "stagger")}>
          {items.map((a) => (
            <li key={a.id}>
              <AppointmentCard appointment={a} member={memberById(state, a.familyMemberId)} today={today} />
            </li>
          ))}
        </ul>
      </section>
    );

  const content = (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Every visit, with the papers that go with it."
        actions={
          <Link href="/new?kind=appointment" className="inline-flex h-10 items-center gap-1.5 rounded-[14px] border border-line-strong bg-surface-raised px-3.5 text-[14px] font-bold text-ink hover:border-peach">
            <Plus className="size-4" aria-hidden /> New
          </Link>
        }
      />
      <Surface className={cn("mb-7", isWeb ? "p-5" : "p-3")}>
        <SevenDaySelector selected={selected} today={today} onSelect={(d) => update((s) => ({ ...s, selectedDate: d }))} busy={busy} size={isWeb ? "lg" : "md"} />
        <div className="mt-3 border-t border-line pt-3">
          {onDay.length ? (
            <ul className="space-y-1">
              {onDay.map((a) => (
                <li key={a.id}>
                  <Link href={`/appointments/${a.id}`} className="flex items-center gap-3 rounded-[12px] px-2 py-2 hover:bg-ivory">
                    <span className="w-[68px] text-[14px] font-extrabold text-ink-strong">{formatTime(a.time)}</span>
                    <span className="flex-1 truncate text-[14.5px] font-semibold text-ink">
                      {a.doctor} · {memberById(state, a.familyMemberId)?.name}
                    </span>
                    {a.status === "completed" && <StatusBadge status="completed" />}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-1 text-[14px] text-ink-muted">Nothing on {formatDayShort(selected)}.</p>
          )}
        </div>
      </Surface>
      <div className="space-y-8">
        {upcoming.length === 0 && (
          <EmptyState icon={<CalendarX2 className="size-6" />} title="No appointments coming up." body="Tell SMARAN when your family's next appointment is." action={{ label: "Add appointment", href: "/new?kind=appointment" }} />
        )}
        {list("This week", thisWeek)}
        {list("Later", later)}
        {list("Completed", completed)}
      </div>
    </>
  );

  if (isWeb) return <Screen aside={<><div><SectionLabel>New appointment</SectionLabel>{wispr}</div></>}>{content}</Screen>;
  return (
    <Screen>
      {content}
      <div className="mt-8">{wispr}</div>
    </Screen>
  );
}

const EXTRA_OFFSETS = [4320, 1440, 180, 60];

export function AppointmentDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { state, update } = useStore();
  const { isWeb } = useView();
  const [editing, setEditing] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const appointment = state.appointments.find((a) => a.id === id);

  if (!appointment) {
    return (
      <Screen width="narrow">
        <PageHeader back="/appointments" title="Appointment" />
        <EmptyState icon={<CalendarDays className="size-6" />} title="We couldn't find this appointment." body="Tell SMARAN about it again and it'll be saved." action={{ label: "Add appointment", href: "/new?kind=appointment" }} />
      </Screen>
    );
  }

  const member = memberById(state, appointment.familyMemberId);
  const docs = appointment.documentIds.map((d) => state.documents.find((x) => x.id === d)).filter((d): d is NonNullable<typeof d> => !!d);
  const memberDocs = documentsFor(state, appointment.familyMemberId);
  const done = appointment.status === "completed";
  const at = stamp(appointment.date, appointment.time);

  const draft: AppointmentDraft = {
    transcript: "",
    memberId: appointment.familyMemberId,
    doctor: appointment.doctor,
    date: appointment.date,
    time: appointment.time,
    location: appointment.location,
    notes: appointment.notes,
    reminderOffsets: appointment.reminders.filter((r) => r.enabled).map((r) => r.offsetMinutes),
    assumptions: [],
  };

  const details = (
    <section>
      <SectionLabel>Appointment details</SectionLabel>
      <Surface className="px-5">
        <dl className="divide-y divide-line">
          <DetailRow label="Doctor">{appointment.doctor}</DetailRow>
          <DetailRow label="For">
            <Link href={`/family/${member?.id}`} className="inline-flex items-center gap-2 hover:underline">
              <MemberAvatar member={member} size={22} /> {member?.name}
            </Link>
          </DetailRow>
          <DetailRow label="Date">{formatDayShort(appointment.date)}</DetailRow>
          <DetailRow label="Time">{formatTime(appointment.time)}</DetailRow>
          <DetailRow label="Location">{appointment.location ?? <span className="text-ink-muted">Not added</span>}</DetailRow>
        </dl>
        {appointment.notes && (
          <div className="border-t border-line py-4">
            <div className="text-[13px] text-ink-muted">Note</div>
            <p className="mt-1 text-[15.5px] font-semibold text-ink-strong">{appointment.notes}</p>
          </div>
        )}
      </Surface>
    </section>
  );

  const documents = (
    <section>
      <SectionLabel
        action={
          <button type="button" onClick={() => setAttaching(true)} className="inline-flex items-center gap-1 text-[12.5px] font-bold text-peach-deep hover:underline">
            <Paperclip className="size-3.5" aria-hidden /> Attach
          </button>
        }
      >
        Documents
      </SectionLabel>
      {docs.length ? (
        <Surface className="divide-y divide-line px-4">
          {docs.map((d) => {
            const Icon = DOC_ICON[d.type];
            return (
              <div key={d.id} className="flex items-center gap-3 py-3">
                <span className="flex size-10 items-center justify-center rounded-[12px] bg-peach-soft/60 text-peach-deep">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <Link href={`/documents/${d.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate text-[15px] font-bold text-ink-strong">{d.name}</span>
                  <span className="block text-[13px] text-ink-muted">{formatShort(d.date)}</span>
                </Link>
                <button
                  type="button"
                  aria-label={`Detach ${d.name}`}
                  onClick={() => {
                    update((s) => linkDocument(s, d.id, undefined));
                    toast(`${d.name} detached`);
                  }}
                  className="inline-flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-ivory-deep"
                >
                  <X className="size-4" />
                </button>
              </div>
            );
          })}
        </Surface>
      ) : (
        <button type="button" onClick={() => setAttaching(true)} className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-line-strong bg-surface/60 px-4 py-5 text-[14.5px] font-semibold text-ink-muted hover:border-peach">
          <Paperclip className="size-4" aria-hidden /> Attach reports or prescriptions to bring
        </button>
      )}
    </section>
  );

  const reminders = (
    <section>
      <SectionLabel>Reminders</SectionLabel>
      <Surface className="divide-y divide-line px-4">
        {appointment.reminders.map((r) => (
          <label key={r.id} className="flex cursor-pointer items-center gap-3 py-3.5">
            <span className="flex-1">
              <span className="block text-[15px] font-bold text-ink-strong">{r.label}</span>
              <span className="block text-[13px] text-ink-muted">
                {formatShort(dateOf(addMinutes(at, -r.offsetMinutes)))} · {formatTime(timeOf(addMinutes(at, -r.offsetMinutes)))}
              </span>
            </span>
            <Switch checked={r.enabled} disabled={done} onCheckedChange={() => update((s) => toggleAppointmentReminder(s, appointment.id, r.id))} aria-label={`Remind ${r.label}`} />
          </label>
        ))}
        {appointment.reminders.length === 0 && <p className="py-4 text-[14px] text-ink-muted">No reminders set.</p>}
      </Surface>
      {!done && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXTRA_OFFSETS.filter((o) => !appointment.reminders.some((r) => r.offsetMinutes === o)).map((o) => (
            <button key={o} type="button" onClick={() => update((s) => addAppointmentReminder(s, appointment.id, o))} className="inline-flex h-8 items-center gap-1 rounded-full border border-line-strong bg-surface-raised px-3 text-[12.5px] font-bold text-ink hover:border-peach">
              <Plus className="size-3.5" aria-hidden /> {formatOffset(o)}
            </button>
          ))}
        </div>
      )}
    </section>
  );

  const actions = (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="size-4" aria-hidden /> Edit
      </Button>
      <Button
        variant={done ? "outline" : "secondary"}
        onClick={() => {
          update((s) => setAppointmentStatus(s, appointment.id, done ? "upcoming" : "completed"));
          toast.success(done ? "Marked as upcoming" : `${appointment.doctor} appointment completed`);
        }}
      >
        <CheckCircle2 className="size-4" aria-hidden /> {done ? "Mark upcoming" : "Mark done"}
      </Button>
    </div>
  );

  const hero = (
    <Surface className="mb-7 flex items-center gap-4 p-5">
      <div className={cn("flex size-16 shrink-0 flex-col items-center justify-center rounded-[18px]", done ? "bg-paused-bg text-brown" : "bg-peach-soft/70 text-ink-strong")}>
        <span className="text-[11px] font-extrabold tracking-wider uppercase">{formatShort(appointment.date).split(" ")[0]}</span>
        <span className="text-[24px] leading-none font-extrabold">{formatShort(appointment.date).split(" ")[1]}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[18px] font-extrabold text-ink-strong">
          {formatDayLong(appointment.date)} · {formatTime(appointment.time)}
        </div>
        {appointment.location && (
          <div className="mt-0.5 flex items-center gap-1.5 text-[14px] text-ink-muted">
            <MapPin className="size-3.5" aria-hidden /> {appointment.location}
          </div>
        )}
      </div>
      <StatusBadge status={done ? "completed" : "upcoming"} />
    </Surface>
  );

  const dialogs = (
    <>
      <AppointmentDraftEditor
        open={editing}
        onOpenChange={setEditing}
        draft={draft}
        family={state.family}
        onSave={(d) => {
          update((s) => {
            let next = updateAppointment(s, appointment.id, { doctor: d.doctor, date: d.date, time: d.time, location: d.location, familyMemberId: d.memberId });
            for (const o of d.reminderOffsets) next = addAppointmentReminder(next, appointment.id, o);
            const appt = next.appointments.find((a) => a.id === appointment.id)!;
            for (const r of appt.reminders) {
              if (r.enabled !== d.reminderOffsets.includes(r.offsetMinutes)) next = toggleAppointmentReminder(next, appointment.id, r.id);
            }
            return next;
          });
          toast.success("Appointment updated");
        }}
      />
      <Modal open={attaching} onOpenChange={setAttaching} title="Attach documents" description={`${member?.name}'s documents. Attached ones will be ready for ${appointment.doctor}.`}>
        <ul className="space-y-2">
          {memberDocs.map((d) => {
            const on = appointment.documentIds.includes(d.id);
            const Icon = DOC_ICON[d.type];
            return (
              <li key={d.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => update((s) => linkDocument(s, d.id, on ? undefined : appointment.id))}
                  className={cn("flex w-full items-center gap-3 rounded-[16px] border p-3 text-left transition-colors", on ? "border-peach bg-peach-soft/30" : "border-line bg-surface-raised hover:border-line-strong")}
                >
                  <Icon className="size-5 text-peach-deep" aria-hidden />
                  <span className="flex-1">
                    <span className="block text-[15px] font-bold text-ink-strong">{d.name}</span>
                    <span className="block text-[12.5px] text-ink-muted">
                      {formatShort(d.date)}
                      {d.linkedAppointmentId && d.linkedAppointmentId !== appointment.id ? " · attached to another visit" : ""}
                    </span>
                  </span>
                  <span className={cn("flex size-6 items-center justify-center rounded-full", on ? "bg-peach text-ink-strong" : "border-2 border-line-strong")}>{on && <Check className="size-3.5" strokeWidth={3} />}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <Link href={`/documents/upload?appointment=${appointment.id}`} className="mt-1 flex h-11 items-center justify-center gap-2 rounded-[14px] border border-dashed border-line-strong text-[14px] font-bold text-ink hover:border-peach">
          <Upload className="size-4" aria-hidden /> Upload a new document
        </Link>
      </Modal>
    </>
  );

  const header = <PageHeader back="/appointments" eyebrow={`${member?.name}'s appointment`} title={appointment.doctor} />;

  if (isWeb) {
    return (
      <Screen
        aside={
          <>
            {reminders}
            <div>
              <SectionLabel>Manage</SectionLabel>
              {actions}
            </div>
          </>
        }
      >
        {header}
        {hero}
        <div className="space-y-8">
          {details}
          {documents}
        </div>
        {dialogs}
      </Screen>
    );
  }
  return (
    <Screen>
      {header}
      {hero}
      <div className="space-y-7">
        {details}
        {documents}
        {reminders}
        {actions}
      </div>
      {dialogs}
    </Screen>
  );
}

