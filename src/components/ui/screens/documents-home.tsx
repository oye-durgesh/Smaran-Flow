"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, CalendarDays, ChevronRight, ClipboardList, FileText, FolderHeart, Pill, Plus, Printer, ScanLine, Shield, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { latestMeasurement, memberById, measurementsFor } from "@/lib/selectors";
import { formatShort, formatTime } from "@/lib/dates";
import type { ChartRange } from "@/lib/health-record-model";
import { Screen } from "@/components/shell/screen";
import { EmptyState, MemberAvatar, PageHeader, Surface } from "@/components/smaran/primitives";
import { Button } from "@/components/ui/button";
import { WisprFlowInput } from "@/components/smaran/wispr-flow-input";
import { TrendChart } from "@/components/smaran/trend-chart";
import { familySwatch } from "@/lib/family-color";
import { bpSeries, glucoseSeries, historyFor, latestDisplay, vaccinationsFor, vaccinationStatus } from "@/lib/health-record-model";
import { pastVisits, upcomingVisits } from "@/lib/appointment-model";
import { answerQuestion } from "@/lib/nlu";
import { DASHBOARD_DOC_ROWS, WISPR_DOC_EXAMPLES, libraryCounts } from "@/lib/document-library";
import {
  SAMPLE_BP_SERIES,
  SAMPLE_DEMO_BADGE,
  SAMPLE_GLUCOSE_SERIES,
  SAMPLE_HISTORY,
  SAMPLE_VACCINES,
  advanceDemo,
  documentsDashboardLayout,
  liveOrDemoSeries,
  startSampleDemo,
  type DemoSession,
} from "@/lib/document-demo";
import { sameAskRoute } from "@/lib/ask-ui";

const RANGE: ChartRange[] = ["7d", "30d", "90d", "12m", "all"];
const RANGE_LABEL: Record<ChartRange, string> = { "7d": "7d", "30d": "30d", "90d": "90d", "12m": "12 months", all: "All" };

const CAT_ICON = {
  prescriptions: Pill,
  blood_tests: Activity,
  imaging: ScanLine,
  discharge: ClipboardList,
  notes: FileText,
  vaccination: ShieldCheck,
  insurance: Shield,
  other: FileText,
};

export function DocumentsHome() {
  const { state } = useStore();
  const { isWeb } = useView();
  const layout = documentsDashboardLayout();
  const [person, setPerson] = useState(state.family[0]?.id ?? "all");
  const [range, setRange] = useState<ChartRange>("12m");
  const [demo, setDemo] = useState<DemoSession | null>(null);
  const [askText, setAskText] = useState<string | null>(null);
  const [askBusy, setAskBusy] = useState(false);

  const selected = person === "all" ? undefined : memberById(state, person);
  const swatch = selected ? familySwatch(selected) : undefined;
  const counts = libraryCounts(state, person === "all" ? "all" : person);
  const history = selected ? historyFor(state, selected.id) : [];
  const vaccines = selected ? vaccinationsFor(state, selected.id) : [];
  const upcoming = upcomingVisits(state, selected?.id);
  const lastVisit = pastVisits(state, selected?.id)[0];
  const liveBp = selected ? bpSeries(state, selected.id, range) : [];
  const liveGlu = selected ? glucoseSeries(state, selected.id, range) : [];
  const demoBp = demo?.kind === "bp" && demo.step === "confirmed" && demo.preview.length ? demo.preview : SAMPLE_BP_SERIES;
  const demoGlu = demo?.kind === "glucose" && demo.step === "confirmed" && demo.preview.length ? demo.preview : SAMPLE_GLUCOSE_SERIES;
  const bpView = liveOrDemoSeries(liveBp, demoBp);
  const gluView = liveOrDemoSeries(liveGlu, demoGlu);
  const latestBp = selected ? latestDisplay(latestMeasurement(state, selected.id, "blood_pressure")) : null;
  const latestGlu = selected ? latestDisplay(latestMeasurement(state, selected.id, "blood_sugar")) : null;
  const docsForRecent = selected ? state.documents.filter((d) => d.familyMemberId === selected.id) : state.documents;
  const measuresForRecent = selected ? measurementsFor(state, selected.id) : state.measurements;
  const recent = [
    ...docsForRecent.slice(0, 3).map((d) => ({ id: d.id, title: d.name, date: d.date, href: `/documents/${d.id}`, sample: d.metadata.source === "sample" })),
    ...measuresForRecent.slice(0, 2).map((m) => ({ id: m.id, title: `${m.kind.replace("_", " ")} ${m.value} ${m.unit}`, date: m.recordedAt.slice(0, 10), href: selected ? `/health-card/${selected.id}` : "/documents", sample: m.source === "sample" })),
  ].slice(0, 5);

  async function ask(text: string) {
    setAskBusy(true);
    try {
      const res = await fetch(sameAskRoute(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          timezone: "Asia/Kolkata",
          filterMemberId: selected?.id,
          evidence: {
            family: state.family.map((m) => ({ id: m.id, name: m.name, relationship: m.relationship })),
            appointments: state.appointments.map((a) => ({ id: a.id, familyMemberId: a.familyMemberId, doctor: a.doctor, date: a.date, time: a.time, status: a.status })),
            reminders: state.reminders.map((r) => ({ id: r.id, familyMemberId: r.familyMemberId, title: r.title, kind: r.kind, time: r.time, frequency: r.frequency })),
            measurements: state.measurements.map((m) => ({ id: m.id, familyMemberId: m.familyMemberId, kind: m.kind, value: m.value, unit: m.unit, recordedAt: m.recordedAt })),
            documents: state.documents.map((d) => ({ id: d.id, familyMemberId: d.familyMemberId, name: d.name, type: d.type, date: d.date })),
          },
        }),
      });
      const data = (await res.json()) as { text?: string };
      if (typeof data.text === "string") setAskText(data.text);
      else setAskText(answerQuestion(text, state, selected?.id).text);
    } catch {
      setAskText(answerQuestion(text, state, selected?.id).text);
    } finally {
      setAskBusy(false);
    }
  }

  const addHref = person === "all" ? "/documents/upload" : `/documents/upload?member=${person}`;
  const printHref = selected ? `/share/health-card/${selected.id}?print=1` : undefined;

  const header = (
    <>
      <PageHeader
        title="Documents & Reports"
        subtitle="Prescriptions, reports, scans and health records — organized by person."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={addHref} className="inline-flex h-10 items-center gap-1.5 rounded-[14px] bg-peach px-4 text-[14px] font-bold text-ink-strong hover:bg-[#e29c7e]">
              <Plus className="size-4" /> Add document
            </Link>
            {printHref ? (
              <Link href={printHref} target="_blank" className="inline-flex h-10 items-center gap-1.5 rounded-[14px] border border-line-strong px-3 text-[13px] font-bold">
                <Printer className="size-4" /> Print
              </Link>
            ) : (
              <button type="button" disabled className="inline-flex h-10 items-center gap-1.5 rounded-[14px] border border-line px-3 text-[13px] font-bold text-ink-muted" title="Select a person to print their Health Card.">
                <Printer className="size-4" /> Print
              </button>
            )}
          </div>
        }
      />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {[{ id: "all", name: "All" }, ...state.family.map((m) => ({ id: m.id, name: m.name }))].map((m) => {
          const member = m.id === "all" ? undefined : memberById(state, m.id);
          const color = member ? familySwatch(member) : undefined;
          return (
            <button key={m.id} type="button" onClick={() => setPerson(m.id)} className={cn("h-9 shrink-0 rounded-full px-3 text-[13px] font-bold", person === m.id ? "bg-peach text-ink-strong" : "border border-line-strong bg-surface-raised")} style={color && person === m.id ? { backgroundColor: color.primary, color: "#fff" } : undefined}>
              {m.name}
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="mb-5 flex items-center gap-3 rounded-[18px] border px-3 py-2" style={{ borderColor: swatch?.border, backgroundColor: swatch?.background }}>
          <MemberAvatar member={selected} size={48} identity />
          <div>
            <p className="text-[18px] font-extrabold" style={{ color: swatch?.text }}>{selected.name}</p>
            <p className="text-[13px] text-ink-muted">{selected.relationship}{selected.age ? ` · ${selected.age} years` : ""} · records stay on this person</p>
          </div>
        </div>
      )}
    </>
  );

  const summaries = (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Summary title="Medical history" value={history.length ? `${history.length} saved` : "None recorded"} meta={history.length ? "From this person's file" : "No medical history recorded yet."} href={selected ? `/health-card/${selected.id}` : "/family"} />
      <Summary title="Latest blood pressure" value={latestBp?.value ?? "No reading recorded"} meta={latestBp?.meta ?? "Not recorded"} href={selected ? `/health-card/${selected.id}` : undefined} />
      <Summary title="Latest glucose" value={latestGlu?.value ?? "No reading recorded"} meta={latestGlu?.meta ?? "Not recorded"} href={selected ? `/health-card/${selected.id}` : undefined} />
      <Summary title="Latest checkup" value={lastVisit ? lastVisit.doctor : "No visit recorded"} meta={lastVisit ? `${lastVisit.date} · ${lastVisit.time}` : "Not recorded"} href={lastVisit ? `/appointments/${lastVisit.id}` : "/appointments"} />
    </div>
  );

  const charts = (
    <div className={cn("mb-5 grid gap-4", layout.charts)}>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[16px] font-extrabold">Blood pressure · Last 12 months</h3>
          <span className="text-[12.5px] text-ink-muted">mmHg</span>
        </div>
        <RangePills range={range} onRange={setRange} />
        {bpView.sample && <p className="mb-2 text-[12.5px] font-bold text-waiting">Sample demo — values are fictional.</p>}
        <TrendChart title="Blood pressure" help={bpView.sample ? SAMPLE_DEMO_BADGE : "Confirmed saved readings only. Gaps stay empty."} seriesA={bpView.series} seriesB={bpView.series.map((p) => ({ ...p, value: p.extra ?? p.value }))} labelA="Systolic" labelB="Diastolic" unit="mmHg" empty="No confirmed readings recorded yet." />
        {selected && <Link href={`/health-card/${selected.id}`} className="mt-2 inline-block text-[13px] font-bold text-peach-deep hover:underline">Open full BP history</Link>}
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[16px] font-extrabold">Blood glucose · Last 12 months</h3>
          <span className="text-[12.5px] text-ink-muted">{gluView.series[0]?.unit || "mg/dL"}</span>
        </div>
        <RangePills range={range} onRange={setRange} />
        {gluView.sample && <p className="mb-2 text-[12.5px] font-bold text-waiting">Sample demo — values are fictional.</p>}
        <TrendChart title="Blood glucose" help={gluView.sample ? SAMPLE_DEMO_BADGE : "Glucose only. HbA1c stays separate."} seriesA={gluView.series} labelA="Glucose" unit={gluView.series[0]?.unit || "mg/dL"} empty="No confirmed readings recorded yet." />
        {selected && <Link href={`/health-card/${selected.id}`} className="mt-2 inline-block text-[13px] font-bold text-peach-deep hover:underline">Open full glucose history</Link>}
      </div>
    </div>
  );

  const lower = (
    <div className={cn("grid gap-4", layout.lower)}>
      <Surface className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[16px] font-extrabold">Medical history</h3>
          <Link href={selected ? `/health-card/${selected.id}` : "/family"} className="text-[13px] font-bold text-peach-deep">View all</Link>
        </div>
        {history.length === 0 ? (
          <>
            <p className="text-[14px] text-ink-muted">No medical history recorded yet.</p>
            <p className="mt-2 text-[12.5px] font-bold text-waiting">{SAMPLE_DEMO_BADGE}</p>
            <ul className="mt-2 space-y-1 text-[13.5px]">{SAMPLE_HISTORY.map((h) => <li key={h.name}>{h.category}: {h.name}</li>)}</ul>
          </>
        ) : (
          <ul className="space-y-2">{history.slice(0, 5).map((h) => <li key={h.id}><span className="font-bold">{h.name}</span> <span className="text-ink-muted">· {h.category}{h.source === "sample" ? " · sample" : ""}</span></li>)}</ul>
        )}
        <Link href={selected ? `/health-card/${selected.id}` : "/family"} className="mt-3 inline-block text-[13px] font-bold">Add history</Link>
      </Surface>

      <Surface className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[16px] font-extrabold">Documents & Reports</h3>
          <Link href={addHref} className="text-[13px] font-bold text-peach-deep">Add</Link>
        </div>
        <ul className="space-y-1">
          {DASHBOARD_DOC_ROWS.map((row) => {
            const Icon = CAT_ICON[row.key];
            const n = counts.categories[row.key];
            return (
              <li key={row.key}>
                <Link href={selected ? `/documents?person=${selected.id}&category=${row.key}` : `/documents?category=${row.key}`} onClick={(e) => { e.preventDefault(); document.getElementById("doc-library")?.scrollIntoView({ behavior: "smooth" }); }} className="flex items-center gap-3 rounded-[12px] px-2 py-2 hover:bg-ivory">
                  <span className="flex size-8 items-center justify-center rounded-[10px] bg-sand/50"><Icon className="size-4" aria-hidden /></span>
                  <span className="flex-1 font-bold">{row.label}</span>
                  <span className="text-[13px] text-ink-muted">{n}</span>
                  <ChevronRight className="size-4 text-ink-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Surface>

      <Surface className="p-4">
        <h3 className="mb-3 text-[16px] font-extrabold">Vaccination schedule</h3>
        {vaccines.length === 0 ? (
          <>
            <p className="text-[14px] text-ink-muted">No vaccinations recorded yet.</p>
            <p className="mt-2 text-[12.5px] font-bold text-waiting">{SAMPLE_DEMO_BADGE}</p>
            <ul className="mt-2 space-y-1 text-[13.5px]">{SAMPLE_VACCINES.map((v) => <li key={v.name}>{v.name} · {v.receivedDate} · {v.status}</li>)}</ul>
          </>
        ) : (
          <ul className="space-y-2">{vaccines.map((v) => <li key={v.id}><span className="font-bold">{v.name}</span> <span className="text-ink-muted">· {v.receivedDate || "Not recorded"} · {vaccinationStatus(v)}</span></li>)}</ul>
        )}
        {selected && <Link href={`/health-card/${selected.id}`} className="mt-3 inline-block text-[13px] font-bold text-peach-deep">Open vaccinations</Link>}
      </Surface>
    </div>
  );

  const library = (
    <section id="doc-library" className="mt-6">
      <h3 className="mb-3 text-[16px] font-extrabold">Document library</h3>
      {counts.total === 0 ? (
        <EmptyState icon={<FolderHeart className="size-6" />} title="No documents uploaded yet." body={selected ? `${selected.name} has no reports yet.` : "Add a prescription, report or scan."} action={{ label: "Add document", href: addHref }} />
      ) : (
        <ul className="space-y-2">
          {(selected ? state.documents.filter((d) => d.familyMemberId === selected.id) : state.documents).slice(0, 8).map((d) => (
            <li key={d.id}>
              <Link href={`/documents/${d.id}`} className="flex items-center justify-between rounded-[14px] border border-line bg-surface-raised px-3 py-2 hover:border-peach">
                <span className="font-bold">{d.name}</span>
                <span className="text-[12.5px] text-ink-muted">{formatShort(d.date)}{d.metadata.source === "sample" ? " · sample" : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const demoPanel = (
    <Surface className="space-y-3 p-4">
      <p className="text-[15px] font-extrabold">Try a sample report</p>
      <p className="text-[13px] text-ink-muted">Deterministic fixtures. They never write to Health Card or Supabase measurements.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setDemo(advanceDemo(startSampleDemo("bp"), "review"))}>Try sample BP report</Button>
        <Button size="sm" variant="outline" onClick={() => setDemo(advanceDemo(startSampleDemo("glucose"), "review"))}>Try sample glucose report</Button>
      </div>
      {demo && (
        <div className="rounded-[14px] bg-sand/40 p-3 text-[13.5px]">
          <p className="font-extrabold text-waiting">{SAMPLE_DEMO_BADGE}</p>
          <p className="mt-1">{demo.result.fields[0]?.label}: {demo.result.fields[0]?.value} {demo.result.fields[0]?.unit}</p>
          <p className="text-ink-muted">Evidence: {demo.result.fields[0]?.excerpt}</p>
          {demo.step !== "confirmed" ? (
            <Button size="sm" className="mt-2" onClick={() => setDemo(advanceDemo(demo, "confirmed"))}>Confirm sample preview</Button>
          ) : (
            <p className="mt-2 font-bold">Sample chart updated. Family records were not changed.</p>
          )}
        </div>
      )}
    </Surface>
  );

  const aside = (
    <div className="space-y-5">
      <WisprFlowInput
        placeholder="Ask about this person's reports…"
        examples={WISPR_DOC_EXAMPLES}
        examplesAction="fill"
        support="Speak naturally — SMARAN will organize it for you."
        onSubmit={ask}
        busy={askBusy}
      />
      {askText && <p className="rounded-[14px] bg-ivory-deep/60 p-3 text-[13.5px]" role="status">{askText}</p>}
      {demoPanel}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[14px] font-extrabold">Recent records</h3>
        </div>
        {recent.length === 0 ? <p className="text-[13px] text-ink-muted">No saved records yet.</p> : (
          <ul className="space-y-2">{recent.map((r) => (
            <li key={r.id}><Link href={r.href} className="block rounded-[12px] px-1 py-1 hover:bg-ivory"><span className="font-bold">{r.title}</span> <span className="text-[12.5px] text-ink-muted">· {r.date}{r.sample ? " · sample" : ""}</span></Link></li>
          ))}</ul>
        )}
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[14px] font-extrabold">Upcoming</h3>
          <Link href="/appointments" className="text-[12.5px] font-bold text-peach-deep">View all</Link>
        </div>
        {upcoming.length === 0 ? <p className="text-[13px] text-ink-muted">No upcoming visits recorded.</p> : (
          <ul className="space-y-2">{upcoming.slice(0, 4).map((a) => (
            <li key={a.id}><Link href={`/appointments/${a.id}`} className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-4 text-ink-muted" /><span><span className="font-bold">{a.doctor}</span> <span className="block text-[12.5px] text-ink-muted">{formatShort(a.date)} · {formatTime(a.time)}{a.source === "sample" ? " · sample" : ""}</span></span></Link></li>
          ))}</ul>
        )}
      </div>
    </div>
  );

  return (
    <Screen width="wide" aside={isWeb ? aside : undefined}>
      <div className="overflow-x-hidden">
        {header}
        {summaries}
        {charts}
        {lower}
        {library}
        {!isWeb && <div className="mt-8 space-y-5">{aside}</div>}
      </div>
    </Screen>
  );
}

function Summary({ title, value, meta, href }: { title: string; value: string; meta: string; href?: string }) {
  const inner = (
    <Surface className="h-full p-4">
      <p className="text-[12px] font-bold tracking-[0.12em] text-ink-muted uppercase">{title}</p>
      <p className="mt-1 text-[18px] font-extrabold text-ink-strong">{value}</p>
      <p className="text-[12.5px] text-ink-muted">{meta}</p>
    </Surface>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function RangePills({ range, onRange }: { range: ChartRange; onRange: (r: ChartRange) => void }) {
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {RANGE.map((r) => (
        <button key={r} type="button" onClick={() => onRange(r)} className={cn("h-7 rounded-full px-2.5 text-[12px] font-bold", range === r ? "bg-peach" : "border border-line")}>{RANGE_LABEL[r]}</button>
      ))}
    </div>
  );
}
