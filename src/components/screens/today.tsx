"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarHeart, ChevronRight, FileText, MessageCircleQuestion, Plus, Sparkles, IdCard } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { useT } from "@/lib/i18n";
import { agendaFor, busyDays, memberDaySummary, todayOf, upcomingAppointments, memberById } from "@/lib/selectors";
import { formatDayLong, formatTime, greetingFor, relativeDay, timeOf, weekOf } from "@/lib/dates";
import { Screen } from "@/components/shell/screen";
import { useSendReminderNow } from "@/components/shell/use-send-reminder";
import { SevenDaySelector } from "@/components/smaran/seven-day-selector";
import { AgendaCard } from "@/components/smaran/cards";
import { EmptyState, MemberAvatar, SectionLabel, Surface, CheckDot } from "@/components/smaran/primitives";
import { SmaranSpeakBox } from "@/components/smaran/smaran-speak-box";
import { SmaranLogo } from "@/components/smaran/brand";
import { cn } from "@/lib/utils";

export const CAPTURE_EXAMPLES = ["Mummy ko roz raat 9 baje BP ki medicine yaad dilani hai.", "Mummy ka Dr Sharma ke saath Friday ko 11 baje appointment hai."];

export function useCaptureSubmit() {
  const router = useRouter();
  return (text: string) => router.push(`/new?text=${encodeURIComponent(text)}`);
}

export function FamilyStatusList() {
  const { state } = useStore();
  const today = todayOf(state);
  return (
    <ul className="space-y-3">
      {state.family.map((m) => {
        const s = memberDaySummary(state, m.id, today);
        return (
          <li key={m.id}>
            <Link href={`/family/${m.id}`} className="block rounded-[18px] border border-line bg-surface-raised p-4 hover:border-line-strong">
              <div className="mb-2.5 flex items-center gap-3">
                <MemberAvatar member={m} size={34} />
                <span className="flex-1 text-[15.5px] font-extrabold text-ink-strong">{m.name}</span>
                <span className="text-[12.5px] font-bold text-ink-muted">
                  {s.confirmed}/{s.total} done
                </span>
              </div>
              <ul className="space-y-1.5">
                {s.agenda.map((item) => (
                  <li key={item.id} className="flex items-center gap-2.5 text-[14px]">
                    {item.kind === "reminder" ? <CheckDot done={item.status === "confirmed"} className="size-[18px]" /> : <CalendarHeart className="size-[18px] text-terracotta" aria-hidden />}
                    <span className={cn("flex-1 truncate", item.status === "confirmed" ? "text-ink-muted" : "font-semibold text-ink-strong")}>
                      {item.kind === "reminder" ? item.reminder.title : `${item.appointment.doctor} appointment`}
                    </span>
                    <span className="text-[12px] text-ink-muted">{formatTime(item.time)}</span>
                  </li>
                ))}
                {s.agenda.length === 0 && <li className="text-[13.5px] text-ink-muted">Nothing today.</li>}
              </ul>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function QuickActions() {
  const { state } = useStore();
  const { isWeb } = useView();
  const first = state.family[0];
  const items = [
    { href: "/ask", icon: MessageCircleQuestion, label: "Ask SMARAN", body: "Search family memory" },
    { href: "/documents", icon: FileText, label: "Documents", body: `${state.documents.length} saved` },
    ...(first ? [{ href: `/health-card/${first.id}`, icon: IdCard, label: "Health Card", body: `${first.name}'s summary` }] : []),
  ];
  return (
    <div className={cn("grid gap-2.5", isWeb ? "grid-cols-3" : "grid-cols-3")}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} className="group rounded-[18px] border border-line bg-surface-raised p-3.5 transition-colors hover:border-line-strong">
          <i.icon className="size-5 text-peach-deep" aria-hidden />
          <div className="mt-2 text-[14px] leading-tight font-bold text-ink-strong">{i.label}</div>
          {isWeb && <div className="mt-0.5 text-[12.5px] text-ink-muted">{i.body}</div>}
        </Link>
      ))}
    </div>
  );
}

export function TodayScreen() {
  const { state, update } = useStore();
  const { isWeb } = useView();
  const t = useT();
  const sendNow = useSendReminderNow();
  const today = todayOf(state);
  const selected = state.selectedDate;
  const agenda = agendaFor(state, selected);
  const busy = busyDays(state, weekOf(selected));
  const greeting = t(greetingFor(timeOf(state.demoNow)));
  const isToday = selected === today;
  const confirmedCount = agenda.filter((i) => i.kind === "reminder" && i.status === "confirmed").length;
  const reminderCount = agenda.filter((i) => i.kind === "reminder").length;

  const setDate = (date: string) => update((s) => ({ ...s, selectedDate: date }));

  const heading = (
    <div className={cn(isWeb ? "mb-8" : "mb-6")}>
      <h1 className={cn("font-extrabold tracking-tight text-ink-strong", isWeb ? "text-[36px] leading-tight" : "text-[28px] leading-tight")}>
        {greeting}, {state.user.name}.
      </h1>
      <p className={cn("mt-1.5 text-ink-muted", isWeb ? "text-[17px]" : "text-[15.5px]")}>{t("todaySubtitle")}</p>
    </div>
  );

  const list = (
    <section aria-label="Today's memory">
      <SectionLabel
        action={
          reminderCount > 0 && (
            <span className="text-[12.5px] font-bold text-ink-muted">
              {confirmedCount} of {reminderCount} confirmed
            </span>
          )
        }
      >
        {isToday ? t("todaysMemory") : `${relativeDay(selected, today)} · ${formatDayLong(selected)}`}
      </SectionLabel>
      {agenda.length > 0 ? (
        <ul className="space-y-3 stagger" key={selected}>
          {agenda.map((item) => (
            <li key={item.id}>
              <AgendaCard item={item} today={today} onSend={isToday ? sendNow : undefined} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title="Nothing to remember yet."
          body="Tell SMARAN what your family needs to remember."
          action={{ label: "Add reminder", href: "/new?kind=reminder" }}
        />
      )}
    </section>
  );

  const wispr = <SmaranSpeakBox />;

  if (isWeb) {
    const upcoming = upcomingAppointments(state).slice(0, 3);
    return (
      <Screen
        aside={
          <>
            {wispr}
            <div>
              <SectionLabel action={<Link href="/appointments" className="text-[12.5px] font-bold text-peach-deep hover:underline">All</Link>}>{t("upcoming")}</SectionLabel>
              <ul className="space-y-2">
                {upcoming.map((a) => (
                  <li key={a.id}>
                    <Link href={`/appointments/${a.id}`} className="flex items-center gap-3 rounded-[16px] border border-line bg-surface-raised p-3 hover:border-line-strong">
                      <MemberAvatar member={memberById(state, a.familyMemberId)} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-bold text-ink-strong">{a.doctor}</span>
                        <span className="block truncate text-[12.5px] text-ink-muted">
                          {memberById(state, a.familyMemberId)?.name} · {relativeDay(a.date, today)} · {formatTime(a.time)}
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-ink-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
                {upcoming.length === 0 && <li className="text-[14px] text-ink-muted">No appointments coming up.</li>}
              </ul>
            </div>
            <div>
              <SectionLabel>{t("familyStatus")}</SectionLabel>
              <FamilyStatusList />
            </div>
          </>
        }
      >
        {heading}
        <Surface className="mb-8 p-5">
          <SevenDaySelector selected={selected} today={today} onSelect={setDate} busy={busy} size="lg" />
        </Surface>
        {list}
        <div className="mt-8 flex items-center justify-between gap-3">
          <SectionLabel className="mb-0">Shortcuts</SectionLabel>
          <Link href="/new?kind=reminder" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface-raised px-3.5 text-[13px] font-bold text-ink hover:border-peach">
            <Plus className="size-4" aria-hidden /> Add reminder
          </Link>
        </div>
        <div className="mt-3">
          <QuickActions />
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="mb-5 flex items-center justify-between">
        <SmaranLogo size="sm" />
        <Link href="/settings" aria-label="Profile and settings" className="flex size-10 items-center justify-center rounded-full bg-sand text-[15px] font-extrabold text-brown">
          {state.user.name.charAt(0)}
        </Link>
      </div>
      {heading}
      <SevenDaySelector selected={selected} today={today} onSelect={setDate} busy={busy} className="mb-7" />
      {list}
      <div className="mt-6">
        <QuickActions />
      </div>
      <div className="mt-7">{wispr}</div>
    </Screen>
  );
}
