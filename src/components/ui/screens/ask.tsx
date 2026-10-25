"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, ChevronRight, Lightbulb, Loader2, Paperclip, SearchX, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { answerQuestion, healthLabel, type Answer } from "@/lib/nlu";
import { latestMeasurement, memberById } from "@/lib/selectors";
import { uid } from "@/lib/store/actions";
import type { AppState, HealthMeasurement } from "@/lib/types";
import { formatShort, formatTime, dateOf, timeOf } from "@/lib/dates";
import { Screen } from "@/components/shell/screen";
import { AppointmentCard, DocumentCard, ReminderRow } from "@/components/smaran/cards";
import { PageHeader } from "@/components/smaran/primitives";
import { SmaranBotAvatar } from "@/components/smaran/smaran-bot-avatar";
import { WisprFlowMark } from "@/components/smaran/brand";
import { TrendChart } from "@/components/smaran/trend-chart";
import { familySwatch } from "@/lib/family-color";
import { bpSeries, glucoseSeries } from "@/lib/health-record-model";
import { ASK_PLACEHOLDER, ASK_SUBTITLE, ASK_SUGGESTIONS, WISPR_FOCUS_HINT, WISPR_HEADING, WISPR_SUPPORT, askLayoutContract, greetingText, handleComposerKey, sameAskRoute } from "@/lib/ask-ui";
import { todayOf } from "@/lib/selectors";

interface Turn {
  id: string;
  question: string;
  answer?: Answer;
  error?: string;
  at: string;
}

function groundedAnswer(question: string, state: AppState, filter: string): Answer {
  try {
    return answerQuestion(question, state, filter === "all" ? undefined : filter);
  } catch {
    return { found: false, refs: [], text: "Something went wrong while searching SMARAN. Try again." };
  }
}

export function AskScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { state } = useStore();
  const { isWeb } = useView();
  const layout = askLayoutContract();
  const [filter, setFilter] = useState("all");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [seeAll, setSeeAll] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [wisprHint, setWisprHint] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  useEffect(() => {
    const q = params.get("q");
    if (!q || started.current) return;
    started.current = true;
    void submit(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function submit(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true);
    const at = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
    const pendingId = uid("q");
    setTurns((all) => [...all, { id: pendingId, question, at }]);
    setDraft("");
    try {
      const res = await fetch(sameAskRoute(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          timezone: "Asia/Kolkata",
          filterMemberId: filter === "all" ? undefined : filter,
          evidence: {
            family: state.family.map((m) => ({ id: m.id, name: m.name, relationship: m.relationship })),
            appointments: state.appointments.map((a) => ({ id: a.id, familyMemberId: a.familyMemberId, doctor: a.doctor, date: a.date, time: a.time, status: a.status })),
            reminders: state.reminders.map((r) => ({ id: r.id, familyMemberId: r.familyMemberId, title: r.title, kind: r.kind, time: r.time, frequency: r.frequency })),
            measurements: state.measurements.map((m) => ({
              id: m.id,
              familyMemberId: m.familyMemberId,
              kind: m.kind,
              value: m.value,
              unit: m.unit,
              recordedAt: m.recordedAt,
              systolic: m.systolic,
              diastolic: m.diastolic,
              glucoseContext: m.glucoseContext,
            })),
            documents: state.documents.map((d) => ({ id: d.id, familyMemberId: d.familyMemberId, name: d.name, type: d.type, date: d.date })),
          },
        }),
      });
      const data = (await res.json()) as Answer & { error?: string };
      if (!res.ok || typeof data.text !== "string") {
        const local = groundedAnswer(question, state, filter);
        setTurns((all) => all.map((t) => (t.id === pendingId ? { ...t, answer: local, error: data.error || "Ask request failed. Showing this device's saved records." } : t)));
        return;
      }
      setTurns((all) => all.map((t) => (t.id === pendingId ? { ...t, answer: data } : t)));
    } catch {
      const local = groundedAnswer(question, state, filter);
      setTurns((all) => all.map((t) => (t.id === pendingId ? { ...t, answer: local, error: "Could not reach Ask. Showing this device's saved records." } : t)));
    } finally {
      setBusy(false);
    }
  }

  function applySuggestion(question: string, href?: string) {
    if (href) {
      router.push(href);
      return;
    }
    setDraft(question);
    void submit(question);
  }

  const suggestions = seeAll ? ASK_SUGGESTIONS : ASK_SUGGESTIONS.slice(0, 5);
  const suggestionList = (
    <ul className="space-y-2">
      {suggestions.map((s) => {
        const Icon = s.icon;
        return (
          <li key={s.question}>
            <button type="button" onClick={() => applySuggestion(s.question, s.href)} className="flex w-full items-center gap-3 rounded-[16px] border border-line bg-surface-raised px-3 py-2.5 text-left hover:border-peach">
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[12px]", s.tint)}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-ink-strong">“{s.question}”</span>
                <span className="block text-[12.5px] text-ink-muted">{s.subtitle}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );

  const aside = (
    <div className={cn("space-y-3", layout.desktop.includes("320") ? "" : "")}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-ink-strong">
          <Lightbulb className="size-4 text-peach-deep" aria-hidden /> Try asking
        </h2>
        <button type="button" className="text-[13px] font-bold text-peach-deep hover:underline" onClick={() => setSeeAll((v) => !v)}>
          {seeAll ? "Show less" : "See all"}
        </button>
      </div>
      {suggestionList}
      <p className="rounded-[16px] bg-sand/40 p-3 text-[12.5px] leading-relaxed text-ink">Answers come only from saved family records. This is not medical advice.</p>
    </div>
  );

  function focusForWispr() {
    setWisprHint(true);
    inputRef.current?.focus();
    toast.message(WISPR_FOCUS_HINT);
  }

  const composer = (
    <div className="mx-auto w-full max-w-[720px]">
      <div className="mb-2 flex items-start gap-3 px-0.5">
        <button
          type="button"
          onClick={focusForWispr}
          aria-label={WISPR_HEADING}
          title={WISPR_FOCUS_HINT}
          className="inline-flex shrink-0 items-center justify-center rounded-[16px] bg-[#F8E8DC] px-2 py-1.5 hover:bg-[#F3D9C8]"
        >
          <WisprFlowMark size={28} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-5 tracking-normal text-ink-strong text-pretty">{WISPR_HEADING}</p>
          <p className="mt-1 text-[13px] leading-5 tracking-normal text-[#7A5346] text-pretty">{WISPR_SUPPORT}</p>
          {wisprHint && (
            <p className="mt-1 text-[12.5px] leading-5 text-ink-muted" role="status">
              {WISPR_FOCUS_HINT}
            </p>
          )}
        </div>
      </div>
      <div className="flex min-w-0 items-end gap-1.5 rounded-[22px] border border-line-strong bg-surface-raised px-2 py-1.5 shadow-[var(--shadow-soft)] sm:gap-2 sm:px-2.5">
        <Link
          href={filter === "all" ? "/documents/upload" : `/documents/upload?member=${filter}`}
          aria-label="Attach a document"
          className="mb-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-ivory-deep"
        >
          <Paperclip className="size-5" />
        </Link>
        <textarea
          ref={inputRef}
          value={draft}
          rows={1}
          disabled={busy}
          placeholder={ASK_PLACEHOLDER}
          aria-label={ASK_PLACEHOLDER}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            const action = handleComposerKey({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing });
            if (action === "submit") {
              e.preventDefault();
              void submit(draft);
            }
          }}
          className="field-sizing-content max-h-28 min-h-[44px] min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[16px] leading-6 tracking-normal text-ink-strong outline-none"
        />
        <button
          type="button"
          disabled={busy || !draft.trim()}
          onClick={() => void submit(draft)}
          aria-label="Send message"
          className="mb-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-peach text-ink-strong disabled:bg-ivory-deep"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" strokeWidth={2.6} />}
        </button>
      </div>
    </div>
  );

  return (
    <Screen width="wide" aside={isWeb ? aside : undefined} footer={composer} dockComposer className="!max-w-none overflow-x-hidden">
      <div className={cn("mx-auto flex min-h-0 max-w-[760px] flex-col", layout.chat)}>
        <PageHeader title="Ask SMARAN" subtitle={ASK_SUBTITLE} />
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Family filter">
          {[{ id: "all", name: "All" }, ...state.family.map((m) => ({ id: m.id, name: m.name }))].map((m) => {
            const member = m.id === "all" ? undefined : memberById(state, m.id);
            const swatch = member ? familySwatch(member) : undefined;
            return (
              <button key={m.id} type="button" onClick={() => setFilter(m.id)} className={cn("h-9 shrink-0 rounded-full px-3 text-[13px] font-bold", filter === m.id ? "bg-peach text-ink-strong" : "border border-line-strong bg-surface-raised")} style={swatch && filter === m.id ? { backgroundColor: swatch.primary, color: "#fff" } : undefined}>
                {m.name}
              </button>
            );
          })}
        </div>
        {!isWeb && (
          <div className="mb-4 lg:hidden">
            <button type="button" className="text-[13.5px] font-bold text-peach-deep" onClick={() => setSuggestionsOpen((v) => !v)}>
              <Lightbulb className="mr-1 inline size-4" aria-hidden /> Try asking
            </button>
            {suggestionsOpen && <div className="mt-2">{aside}</div>}
          </div>
        )}

        <div className="space-y-5" aria-live="polite">
          <AssistantBubble>
            <p className="whitespace-pre-wrap text-[15.5px] leading-relaxed">{greetingText(state.user.name)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {state.family.map((m) => (
                <button key={m.id} type="button" onClick={() => setFilter(m.id)} className="h-9 rounded-full border border-line-strong px-3 text-[13px] font-bold">
                  {m.name}
                </button>
              ))}
              <button type="button" onClick={() => setFilter("all")} className="h-9 rounded-full border border-line-strong px-3 text-[13px] font-bold">All family</button>
            </div>
          </AssistantBubble>

          {turns.map((t) => (
            <div key={t.id} className="space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[min(85%,520px)] rounded-[20px] rounded-br-[6px] bg-[#F6C7B4] px-4 py-2.5 text-[15.5px] font-semibold text-[#5C3A2E]">
                  {t.question}
                  <p className="mt-1 text-right text-[11px] font-medium text-[#8F4538]/80">{t.at}</p>
                </div>
              </div>
              {t.answer ? (
                <AssistantBubble>
                  {t.error && <p className="mb-2 text-[13px] font-semibold text-waiting" role="alert">{t.error}</p>}
                  <p className="text-[15.5px] leading-relaxed">
                    {t.answer.safety && <ShieldAlert className="mr-1 inline size-4 text-waiting" aria-hidden />}
                    {!t.answer.found && !t.answer.safety && <SearchX className="mr-1 inline size-4 text-ink-muted" aria-hidden />}
                    {t.answer.text}
                  </p>
                  <ResultCard answer={t.answer} state={state} />
                </AssistantBubble>
              ) : (
                <AssistantBubble>
                  <p className="flex items-center gap-2 text-[14px] text-ink-muted"><Loader2 className="size-4 animate-spin" /> Searching saved records…</p>
                </AssistantBubble>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>
    </Screen>
  );
}

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <SmaranBotAvatar size={40} className="mt-0.5" />
      <div className="max-w-[min(88%,560px)] rounded-[20px] rounded-tl-[6px] border border-line bg-surface-raised px-4 py-3 text-ink">{children}</div>
    </div>
  );
}

function ResultCard({ answer, state }: { answer: Answer; state: AppState }) {
  const today = todayOf(state);
  if (!answer.refs.length) {
    if (answer.found) return null;
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/documents/upload" className="rounded-full bg-peach px-3 py-1.5 text-[13px] font-bold">Upload a report</Link>
        <Link href="/family" className="rounded-full border border-line-strong px-3 py-1.5 text-[13px] font-bold">Add a measurement</Link>
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      {answer.refs.map((ref) => {
        if (ref.kind === "measurement") {
          const m = state.measurements.find((x) => x.id === ref.id);
          return m ? <MeasurementResult key={ref.id} m={m} state={state} /> : null;
        }
        if (ref.kind === "document") {
          const d = state.documents.find((x) => x.id === ref.id);
          return d ? <DocumentCard key={ref.id} doc={d} member={memberById(state, d.familyMemberId)} compact /> : null;
        }
        if (ref.kind === "appointment") {
          const a = state.appointments.find((x) => x.id === ref.id);
          return a ? <AppointmentCard key={ref.id} appointment={a} member={memberById(state, a.familyMemberId)} today={today} /> : null;
        }
        const r = state.reminders.find((x) => x.id === ref.id);
        return r ? <ReminderRow key={ref.id} reminder={r} member={memberById(state, r.familyMemberId)} href={`/reminders/${r.id}`} /> : null;
      })}
    </div>
  );
}

function MeasurementResult({ m, state }: { m: HealthMeasurement; state: AppState }) {
  const who = memberById(state, m.familyMemberId);
  const value = m.kind === "blood_pressure" && m.systolic != null ? `${m.systolic}/${m.diastolic}` : m.value;
  const series = m.kind === "blood_pressure" ? bpSeries(state, m.familyMemberId, "90d") : m.kind === "blood_sugar" ? glucoseSeries(state, m.familyMemberId, "90d", false, m.unit) : [];
  const latest = latestMeasurement(state, m.familyMemberId, m.kind);
  const doc = m.documentId ? state.documents.find((d) => d.id === m.documentId) : undefined;
  return (
    <div className="rounded-[16px] border border-line bg-ivory px-3 py-3">
      <p className="text-[12.5px] font-bold text-confirmed">Found in saved records</p>
      <p className="text-[16px] font-extrabold">{who?.name}&apos;s latest {healthLabel(m.kind)}</p>
      <p className="mt-1 text-[22px] font-extrabold text-ink-strong">{value} <span className="text-[14px] font-bold text-ink-muted">{m.unit}</span></p>
      <p className="text-[13px] text-ink-muted">{formatShort(dateOf(m.recordedAt))} · {formatTime(timeOf(m.recordedAt))}{m.glucoseContext ? ` · ${m.glucoseContext.replace("_", " ")}` : ""}{m.source === "sample" ? " · sample family note" : ""}</p>
      {series.length > 0 && <div className="mt-2"><TrendChart title="Recent trend" seriesA={series} seriesB={m.kind === "blood_pressure" ? series.map((p) => ({ ...p, value: p.extra ?? p.value })) : undefined} labelA={m.kind === "blood_pressure" ? "Systolic" : "Glucose"} labelB={m.kind === "blood_pressure" ? "Diastolic" : undefined} unit={m.unit} empty="No confirmed readings recorded yet." /></div>}
      <div className="mt-2 flex flex-wrap gap-2 text-[13px] font-bold">
        <Link href={`/health-card/${m.familyMemberId}`} className="text-peach-deep hover:underline">View full history</Link>
        {doc && <Link href={`/documents/${doc.id}`} className="text-peach-deep hover:underline">Open report</Link>}
        <Link href={`/health-card/${m.familyMemberId}`} className="text-peach-deep hover:underline">Add new reading</Link>
      </div>
      <p className="mt-1 text-[12px] text-ink-muted">Also found in: Documents · Health Card</p>
      {latest && latest.id !== m.id ? <p className="sr-only">Latest stored id {latest.id}</p> : null}
    </div>
  );
}
