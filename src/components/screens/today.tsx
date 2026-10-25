"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarHeart, CheckCircle2, FileText, IdCard, MessageCircleQuestion, Pill, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { useT } from "@/lib/i18n";
import { agendaFor, memberById, todayOf, upcomingAfter } from "@/lib/selectors";
import { formatTime, greetingFor } from "@/lib/dates";
import { formatFullDate, mondayWeekOf, zonedNow } from "@/lib/timezone";
import { TODAY_EXAMPLES, TODAY_SECTIONS, TODAY_SHORTCUTS, captureOnToday } from "@/lib/store/today-capture";
import { createCloudAppointment, createCloudReminder, isUuid } from "@/lib/store/cloud";
import { WeekProgressCalendar } from "@/components/smaran/week-progress-calendar";
import { EmptyState, MemberAvatar, SectionLabel } from "@/components/smaran/primitives";
import { SmaranSpeakBox } from "@/components/smaran/smaran-speak-box";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const CAPTURE_EXAMPLES = TODAY_EXAMPLES;
export { TODAY_SECTIONS, TODAY_SHORTCUTS };

export function useCaptureSubmit() {
  const { commit } = useStore();
  return (text: string) => {
    const result = commit((s) => {
      const out = captureOnToday(s, text);
      return [out.next, out.result];
    });
    return result;
  };
}

function Shortcuts() {
  const { state } = useStore();
  const first = state.family[0];
  const items = [
    { href: TODAY_SHORTCUTS[0].href, icon: MessageCircleQuestion, label: TODAY_SHORTCUTS[0].label, testid: "shortcut-ask" },
    { href: TODAY_SHORTCUTS[1].href, icon: FileText, label: TODAY_SHORTCUTS[1].label, testid: "shortcut-documents" },
    { href: first ? `${TODAY_SHORTCUTS[2].hrefPrefix}${first.id}` : "/family", icon: IdCard, label: TODAY_SHORTCUTS[2].label, testid: "shortcut-health" },
  ];
  return (
    <section data-testid="today-shortcuts">
      <SectionLabel>Shortcuts</SectionLabel>
      <div className="grid grid-cols-3 gap-2.5">
        {items.map((i) => (
          <Link key={i.testid} href={i.href} data-testid={i.testid} className="rounded-[18px] border border-line bg-surface-raised p-3.5 hover:border-line-strong">
            <i.icon className="size-5 text-peach-deep" aria-hidden />
            <div className="mt-2 text-[14px] leading-tight font-bold text-ink-strong">{i.label}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function UpcomingList({ selected }: { selected: string }) {
  const { state } = useStore();
  const items = upcomingAfter(state, selected);
  return (
    <section data-testid="today-upcoming" className="mt-8">
      <SectionLabel>Upcoming</SectionLabel>
      {items.length === 0 ? (
        <p className="rounded-[18px] border border-dashed border-line px-4 py-5 text-[14.5px] text-ink-muted">Nothing upcoming after this day.</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 8).map((item) => (
            <li key={item.id}>
              <Link
                href={item.kind === "appointment" ? `/appointments/${item.appointment.id}` : `/reminders/${item.reminder.id}`}
                className="flex items-center gap-3 rounded-[16px] border border-line bg-surface-raised px-3 py-3 hover:border-line-strong"
              >
                <MemberAvatar member={item.member} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-bold text-ink-strong">{item.title}</span>
                  <span className="block truncate text-[12.5px] text-ink-muted">
                    {item.member?.name} · {item.date} · {formatTime(item.time)}
                    {item.kind === "reminder" && item.reminder.source === "sample" ? " · sample" : ""}
                    {item.kind === "appointment" && item.appointment.source === "sample" ? " · sample" : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Schedule({ selected, today }: { selected: string; today: string }) {
  const { state } = useStore();
  const agenda = agendaFor(state, selected);
  const medicines = agenda.filter((i) => i.kind === "reminder" && i.reminder.kind === "medicine");
  const checks = agenda.filter((i) => i.kind === "reminder" && (i.reminder.kind === "check" || i.reminder.kind === "other"));
  const visits = agenda.filter((i) => i.kind === "appointment" || (i.kind === "reminder" && i.reminder.kind === "pickup"));
  const completed = agenda.filter((i) => (i.kind === "reminder" && i.status === "confirmed") || (i.kind === "appointment" && i.status === "completed"));
  const pendingMeds = medicines.filter((i) => i.kind === "reminder" && i.status !== "confirmed");
  const pendingChecks = checks.filter((i) => i.kind === "reminder" && i.status !== "confirmed");
  const pendingVisits = visits.filter((i) => (i.kind === "appointment" ? i.status === "upcoming" : i.status !== "confirmed"));

  const groups = [
    { key: "medicines", title: "Medicines", items: pendingMeds, icon: Pill },
    { key: "checks", title: "Health checks and care tasks", items: pendingChecks, icon: Sparkles },
    { key: "visits", title: "Appointments and pickups", items: pendingVisits, icon: CalendarHeart },
    { key: "done", title: "Completed", items: completed, icon: CheckCircle2 },
  ];

  return (
    <section data-testid="today-schedule" className="mt-8">
      <SectionLabel>{selected === today ? "Today's Schedule" : formatFullDate(selected)}</SectionLabel>
      {agenda.length === 0 ? (
        <EmptyState icon={<Sparkles className="size-6" />} title="Nothing scheduled for this day." body="Speak or type what your family needs to remember." />
      ) : (
        <div className="space-y-5">
          {groups.map((g) =>
            g.items.length === 0 ? null : (
              <div key={g.key}>
                <p className="mb-2 text-[12px] font-extrabold tracking-[0.14em] text-ink-muted uppercase">{g.title}</p>
                <ul className="space-y-2">
                  {g.items.map((item) => {
                    const done = (item.kind === "reminder" && item.status === "confirmed") || (item.kind === "appointment" && item.status === "completed");
                    const href = item.kind === "reminder" ? `/reminders/${item.reminder.id}` : `/appointments/${item.appointment.id}`;
                    const title = item.kind === "reminder" ? item.reminder.title : `${item.appointment.doctor} appointment`;
                    const sample = item.kind === "reminder" ? item.reminder.source === "sample" : item.appointment.source === "sample";
                    return (
                      <li key={`${g.key}-${item.id}`}>
                        <Link href={href} className={cn("flex items-center gap-3 rounded-[16px] border px-3 py-3", done ? "border-line bg-ivory/80" : "border-line bg-surface-raised")}>
                          <MemberAvatar member={memberById(state, item.kind === "reminder" ? item.reminder.familyMemberId : item.appointment.familyMemberId)} size={34} />
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate text-[14.5px] font-bold", done ? "text-ink-muted line-through" : "text-ink-strong")}>{title}</span>
                            <span className="block text-[12.5px] text-ink-muted">
                              {item.member?.name} · {formatTime(item.time)}
                              {sample ? " · sample" : ""}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

export function TodayScreen() {
  const { state, update, commit, session, refreshVault } = useStore();
  const { isWeb } = useView();
  const t = useT();
  const today = todayOf(state);
  const selected = state.selectedDate;
  const now = zonedNow();
  const greeting = t(greetingFor(now.time));
  const [weekStart, setWeekStart] = useState(mondayWeekOf(selected)[0]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      update((s) => ({ ...s, selectedDate: today }));
      setWeekStart(mondayWeekOf(today)[0]);
    }, 0);
    return () => window.clearTimeout(timer);
    // Reset only when Today is opened — not after the user picks another day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToday = () => {
    update((s) => ({ ...s, selectedDate: today }));
    setWeekStart(mondayWeekOf(today)[0]);
  };

  const wispr = (
    <div data-testid="today-wispr" className="xl:sticky xl:top-6">
      <SmaranSpeakBox
        stayOnPage
        examples={TODAY_EXAMPLES}
        support="Wispr Flow inserts dictated text into this box. SMARAN does not record audio in the browser."
        onCapture={async (text) => {
          const out = commit((s) => {
            const captured = captureOnToday(s, text);
            return [captured.next, captured.result];
          });
          if (!out.ok) {
            toast.error(out.error);
            return out.error;
          }
          if (session.authenticated) {
            const reminder = state.reminders.find((r) => r.id === out.id);
            const appointment = state.appointments.find((a) => a.id === out.id);
            try {
              if (out.kind === "reminder" && reminder && isUuid(reminder.familyMemberId)) {
                await createCloudReminder({ recipientId: reminder.familyMemberId, title: reminder.title, kind: reminder.kind, time: reminder.time, date: reminder.date, recurrence: reminder.frequency });
                await refreshVault();
              }
              if (out.kind === "appointment" && appointment && isUuid(appointment.familyMemberId)) {
                await createCloudAppointment({ recipientId: appointment.familyMemberId, doctor: appointment.doctor, date: appointment.date, time: appointment.time, location: appointment.location, notes: appointment.notes });
                await refreshVault();
              }
            } catch (e) {
              const message = e instanceof Error ? e.message : "Save failed.";
              toast.error(message);
              return message;
            }
          }
          toast.success(`Saved ${out.title}`);
        }}
      />
    </div>
  );

  return (
    <div data-testid="today-screen" className="mx-auto w-full max-w-[1180px] px-4 pt-5 pb-10 sm:px-6 lg:px-8 lg:pt-8">
      <div className={cn("grid gap-8", isWeb ? "xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start" : "")}>
        <div className="min-w-0">
          <header className="mb-6" data-section={TODAY_SECTIONS[0]}>
            <h1 className="text-[28px] leading-tight font-extrabold tracking-tight text-ink-strong sm:text-[34px]">
              {greeting}, {state.user.name}.
            </h1>
            <p className="mt-1 text-[16px] font-semibold text-ink" data-testid="today-full-date">
              {formatFullDate(today)}
            </p>
            <p className="mt-1 text-[15px] text-ink-muted">{t("todaySubtitle")}</p>
          </header>
          <WeekProgressCalendar
            weekStart={weekStart}
            today={today}
            selected={selected}
            state={state}
            onSelect={(date) => {
              update((s) => ({ ...s, selectedDate: date }));
              setWeekStart(mondayWeekOf(date)[0]);
            }}
            onWeekChange={(monday) => setWeekStart(monday)}
            onToday={goToday}
          />
          <UpcomingList selected={selected} />
          <Schedule selected={selected} today={today} />
          <div className="mt-8">
            <Shortcuts />
          </div>
          <div className="mt-8 xl:hidden">{wispr}</div>
        </div>
        <aside className="hidden min-w-0 xl:block" aria-label="Wispr Flow">
          {wispr}
        </aside>
      </div>
    </div>
  );
}
