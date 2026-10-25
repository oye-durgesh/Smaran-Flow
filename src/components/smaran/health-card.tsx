"use client";

import Link from "next/link";
import { Check, Plus, ShieldCheck, Trash2 } from "lucide-react";
import type { AppState, FamilyMember, HealthMeasurement } from "@/lib/types";
import { compareTs, dateOf, formatShort, formatTime, relativeDay, timeOf, addMinutes } from "@/lib/dates";
import { documentsFor, lastUpdatedFor, latestMeasurement, measurementsFor, recentConfirmations, todayOf, upcomingAppointments } from "@/lib/selectors";
import { blank, currentMedicines, frequencyLabel } from "@/lib/medicine-model";
import type { MeasurementKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SmaranLogo } from "./brand";
import { MemberAvatar } from "./primitives";

function lastUpdatedLabel(state: AppState, ts?: string) {
  if (!ts) return "Not updated yet";
  if (compareTs(addMinutes(ts, 3), state.demoNow) >= 0) return "Last updated just now";
  const day = relativeDay(dateOf(ts), todayOf(state));
  return `Last updated ${day === "Today" || day === "Yesterday" ? day.toLowerCase() : formatShort(dateOf(ts))} · ${formatTime(timeOf(ts))}`;
}

const KINDS: { kind: MeasurementKind; label: string }[] = [
  { kind: "blood_pressure", label: "Blood Pressure" },
  { kind: "blood_sugar", label: "Blood Sugar" },
  { kind: "heart_rate", label: "Heart Rate" },
  { kind: "weight", label: "Weight" },
];

function HealthSummary({ state, memberId, onRemove, onAdd }: { state: AppState; memberId: string; onRemove?: (m: HealthMeasurement) => void; onAdd?: () => void }) {
  const history = measurementsFor(state, memberId).slice(0, 6);
  return (
    <Block title="Health">
      {onAdd && (
        <button type="button" onClick={onAdd} className="mb-3 inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-[13px] font-bold text-ink hover:border-peach">
          <Plus className="size-3.5" aria-hidden /> Add measurement
        </button>
      )}
      <ul className="space-y-3">
        {KINDS.map(({ kind, label }) => {
          const m = latestMeasurement(state, memberId, kind);
          return (
            <li key={kind} className="flex items-baseline justify-between gap-3">
              <span>
                <span className="block text-[16px] font-bold text-ink-strong">{label}</span>
                <span className="block text-[12.5px] text-ink-muted">
                  {m
                    ? `${m.source === "sample" ? "Sample family note · " : m.source === "document" ? `Source: ${state.documents.find((d) => d.id === m.documentId)?.name ?? "document"} · ` : ""}${formatShort(dateOf(m.recordedAt))} · ${formatTime(timeOf(m.recordedAt))}`
                    : "Not recorded"}
                </span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="text-[18px] font-extrabold text-ink-strong">{m ? `${m.value} ${m.unit}` : "—"}</span>
                {m && onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(m)}
                    aria-label={`Remove ${label}`}
                    className="inline-flex size-8 items-center justify-center rounded-[10px] text-ink-muted hover:bg-missed-bg hover:text-missed"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {KINDS.map(({ kind, label }) => {
        const series = history.filter((m) => m.kind === kind).slice(0, 4);
        if (series.length < 2) return null;
        return (
          <p key={`${kind}-trend`} className="mt-3 text-[13px] text-ink-muted">
            <span className="font-bold text-ink">Recent {label}:</span> {series.map((m) => m.value).join("  ·  ")}
          </p>
        );
      })}
    </Block>
  );
}

function Block({ title, children, empty }: { title: string; children: React.ReactNode; empty?: string }) {
  return (
    <section className="border-t border-line pt-5">
      <h3 className="mb-3 text-[11.5px] font-extrabold tracking-[0.16em] text-ink-muted uppercase">{title}</h3>
      {children ?? <p className="text-[14px] text-ink-muted">{empty}</p>}
    </section>
  );
}

function Wrap({ linked, href, children, className }: { linked: boolean; href: string; children: React.ReactNode; className?: string }) {
  return linked ? (
    <Link href={href} className={cn("block rounded-[12px] hover:bg-ivory-deep/60", className)}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

export function HealthCard({ state, member, linked = true, className, wide = false, onRemoveMeasurement, onAddMeasurement }: { state: AppState; member: FamilyMember; linked?: boolean; className?: string; wide?: boolean; onRemoveMeasurement?: (m: HealthMeasurement) => void; onAddMeasurement?: () => void }) {
  const today = todayOf(state);
  const upcoming = upcomingAppointments(state, member.id).slice(0, 3);
  const confirmations = recentConfirmations(state, member.id, 4);
  const docs = documentsFor(state, member.id).slice(0, 4);
  return (
    <article className={cn("rounded-[28px] border border-line bg-surface-raised p-6 shadow-[var(--shadow-raised)] sm:p-8", className)} aria-label={`${member.name}'s Health Card`}>
      <div className="flex items-center justify-between gap-4">
        <SmaranLogo size="sm" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sand/60 px-3 py-1 text-[11.5px] font-bold text-brown">
          <ShieldCheck className="size-3.5" aria-hidden /> Family Health Card
        </span>
      </div>

      <div className="mt-7 flex items-center gap-4">
        <MemberAvatar member={member} size={60} />
        <div>
          <h2 className="text-[30px] leading-tight font-extrabold text-ink-strong">{member.name}</h2>
          <p className="text-[14.5px] text-ink-muted">
            {member.relationship}
            {member.age ? ` · ${member.age} years` : ""} · Family health memory
          </p>
        </div>
      </div>

      <div className={cn("mt-7 grid gap-x-10 gap-y-5", wide && "md:grid-cols-2")}>
        <HealthSummary state={state} memberId={member.id} onRemove={onRemoveMeasurement} onAdd={onAddMeasurement} />
        <Block title="Upcoming" empty="No appointments coming up.">
          {upcoming.length > 0 ? (
            <ul className="space-y-1">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <Wrap linked={linked} href={`/appointments/${a.id}`} className="-mx-2 px-2 py-1.5">
                    <div className="text-[16px] font-bold text-ink-strong">{a.doctor}</div>
                    <div className="text-[13.5px] text-ink-muted">
                      {relativeDay(a.date, today)} · {formatTime(a.time)}
                      {a.location ? ` · ${a.location}` : ""}
                    </div>
                  </Wrap>
                </li>
              ))}
            </ul>
          ) : null}
        </Block>

        <Block title="Current medicines" empty="No current medicines recorded.">
          {currentMedicines(state, member.id).length > 0 ? (
            <ul className="space-y-1">
              {currentMedicines(state, member.id).map((med) => (
                <li key={med.id}>
                  <Wrap linked={linked} href="/medicines" className="-mx-2 px-2 py-1.5">
                    <div className="text-[16px] font-bold text-ink-strong">
                      {med.name} {med.status === "paused" && <span className="text-[12px] font-bold text-paused">· Paused</span>}
                    </div>
                    <div className="text-[13.5px] text-ink-muted">
                      {blank(med.dosage)}
                      {med.strength ? ` · ${med.strength}` : ""} · {frequencyLabel(med.frequency, med.times)}
                      {med.times.length ? ` · ${med.times.join(", ")}` : ""}
                    </div>
                  </Wrap>
                </li>
              ))}
            </ul>
          ) : null}
        </Block>

        <Block title="Recent confirmations" empty="No confirmations yet.">
          {confirmations.length > 0 ? (
            <ul className="space-y-2">
              {confirmations.map(({ reminder, confirmation }) => (
                <li key={confirmation.id} className="flex items-center gap-2.5 text-[14.5px]">
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-confirmed text-white">
                    <Check className="size-3" strokeWidth={3.2} aria-hidden />
                  </span>
                  <span className="font-bold text-ink-strong">{reminder.title}</span>
                  <span className="text-ink-muted">
                    — {formatShort(confirmation.date)} · {formatTime(timeOf(confirmation.confirmedAt))}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Block>

        <Block title="Documents" empty="No documents yet.">
          {docs.length > 0 ? (
            <ul className="space-y-1">
              {docs.map((d) => (
                <li key={d.id}>
                  <Wrap linked={linked} href={`/documents/${d.id}`} className="-mx-2 flex items-center justify-between px-2 py-1.5">
                    <span className="text-[15px] font-bold text-ink-strong">{d.name}</span>
                    <span className="text-[13px] text-ink-muted">{formatShort(d.date)}</span>
                  </Wrap>
                </li>
              ))}
            </ul>
          ) : null}
        </Block>
      </div>

      <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[12.5px] text-ink-muted">
        <span>{lastUpdatedLabel(state, lastUpdatedFor(state, member.id))}</span>
        <span>Recorded by family · Not a medical record</span>
      </footer>
    </article>
  );
}
