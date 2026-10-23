"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircleQuestion, SearchX, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { answerQuestion, type Answer } from "@/lib/nlu";
import { memberById, todayOf } from "@/lib/selectors";
import type { AppState } from "@/lib/types";
import { uid } from "@/lib/store/actions";
import { Screen } from "@/components/shell/screen";
import { WisprFlowInput } from "@/components/smaran/wispr-flow-input";
import { AppointmentCard, DocumentCard, ReminderRow } from "@/components/smaran/cards";
import { SmaranMark } from "@/components/smaran/brand";
import { PageHeader, SectionLabel } from "@/components/smaran/primitives";

const SUGGESTIONS = [
  "Mummy ka latest blood report kab ka hai?",
  "Mummy ka next appointment kab hai?",
  "Papa ne subah ki medicine kab li thi?",
  "Mummy ki medicines kya hain?",
];
const DEMO_QUESTION = SUGGESTIONS[0];

interface Turn {
  id: string;
  question: string;
  answer: Answer | null;
}

function Refs({ answer, state }: { answer: Answer; state: AppState }) {
  const today = todayOf(state);
  if (!answer.refs.length) return null;
  return (
    <ul className="mt-3 space-y-2">
      {answer.refs.map((ref) => {
        if (ref.kind === "document") {
          const d = state.documents.find((x) => x.id === ref.id);
          return d ? <li key={ref.id}><DocumentCard doc={d} member={memberById(state, d.familyMemberId)} compact /></li> : null;
        }
        if (ref.kind === "appointment") {
          const a = state.appointments.find((x) => x.id === ref.id);
          return a ? <li key={ref.id}><AppointmentCard appointment={a} member={memberById(state, a.familyMemberId)} today={today} /></li> : null;
        }
        const r = state.reminders.find((x) => x.id === ref.id);
        return r ? <li key={ref.id}><ReminderRow reminder={r} member={memberById(state, r.familyMemberId)} href={`/reminders/${r.id}`} /></li> : null;
      })}
    </ul>
  );
}

export function AskScreen() {
  const params = useSearchParams();
  const { state } = useStore();
  const { isWeb } = useView();
  const demo = params.get("demo") === "1";
  const initialQ = params.get("q");
  const auto = params.get("auto") === "1";

  const [turns, setTurns] = useState<Turn[]>(() => (initialQ && auto ? [{ id: uid("q"), question: initialQ, answer: null }] : []));
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const pending = turns.find((t) => !t.answer);
  useEffect(() => {
    if (!pending) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => {
      setTurns((all) => all.map((x) => (x.id === pending.id ? { ...x, answer: answerQuestion(x.question, stateRef.current) } : x)));
    }, reduced ? 50 : 700);
    return () => window.clearTimeout(t);
  }, [pending]);

  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const ask = (text: string) => {
    if (pending) return "One moment — SMARAN is still answering.";
    setTurns((all) => [...all, { id: uid("q"), question: text, answer: null }]);
  };

  const composer = (
    <WisprFlowInput
      primary
      variant={turns.length ? "composer" : "card"}
      placeholder="Ask about reports, appointments or medicines..."
      examples={turns.length ? [] : SUGGESTIONS.slice(0, isWeb ? 2 : 1)}
      autoTypeText={demo && !initialQ && turns.length === 0 ? DEMO_QUESTION : null}
      autoSubmit={demo}
      busy={!!pending}
      busyLabel="Searching your family's memory…"
      onSubmit={ask}
    />
  );

  return (
    <Screen
      width="narrow"
      footer={turns.length ? composer : undefined}
      aside={
        isWeb ? (
          <>
            <div>
              <SectionLabel>Try asking</SectionLabel>
              <ul className="space-y-2">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button type="button" disabled={!!pending} onClick={() => ask(s)} className="w-full rounded-[16px] border border-line bg-surface-raised px-4 py-3 text-left text-[14px] leading-snug text-ink transition-colors hover:border-peach disabled:opacity-60">
                      “{s}”
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <p className="rounded-[18px] bg-sand/40 p-4 text-[13.5px] leading-relaxed text-ink">
              SMARAN only answers from what your family saved — documents, appointments, reminders and confirmations. It doesn&apos;t give medical advice.
            </p>
          </>
        ) : undefined
      }
    >
      <PageHeader back={isWeb ? undefined : "/today"} title="Ask SMARAN" subtitle="Ask about your family's reports, appointments and medicines." />

      {turns.length === 0 ? (
        <>
          {composer}
          {!isWeb && (
            <section className="mt-7">
              <SectionLabel>Try asking</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.slice(1).map((s) => (
                  <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-line-strong bg-surface-raised px-4 py-2 text-left text-[13.5px] font-semibold text-ink hover:border-peach">
                    {s}
                  </button>
                ))}
              </div>
            </section>
          )}
          <p className="mt-6 flex items-start gap-2 text-[13px] leading-snug text-ink-muted">
            <MessageCircleQuestion className="mt-0.5 size-4 shrink-0" aria-hidden />
            Answers come only from your family&apos;s saved memory. SMARAN won&apos;t guess, and won&apos;t give medical advice.
          </p>
        </>
      ) : (
        <ol className="space-y-6" aria-live="polite">
          {turns.map((t) => (
            <li key={t.id} className="space-y-3">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-[20px] rounded-br-[6px] bg-peach px-4 py-3 text-[15.5px] font-semibold text-ink-strong animate-rise">{t.question}</p>
              </div>
              <div className="flex items-start gap-2.5 animate-rise">
                <SmaranMark size={30} className="mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  {!t.answer ? (
                    <p className="inline-flex items-center gap-2 rounded-[20px] rounded-tl-[6px] border border-line bg-surface-raised px-4 py-3 text-[15px] text-ink-muted" role="status">
                      <span className="flex gap-1" aria-hidden>
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="size-1.5 rounded-full bg-peach-deep animate-breathe" style={{ animationDelay: `${i * 150}ms` }} />
                        ))}
                      </span>
                      Searching your family&apos;s memory…
                    </p>
                  ) : (
                    <>
                      <div className={cn("rounded-[20px] rounded-tl-[6px] border px-4 py-3 text-[15.5px] leading-relaxed", t.answer.safety ? "border-waiting/30 bg-waiting-bg text-ink" : t.answer.found ? "border-line bg-surface-raised text-ink-strong" : "border-line bg-surface text-ink")}>
                        {t.answer.safety && <ShieldAlert className="mr-1.5 inline size-4 -translate-y-px text-waiting" aria-hidden />}
                        {!t.answer.found && !t.answer.safety && <SearchX className="mr-1.5 inline size-4 -translate-y-px text-ink-muted" aria-hidden />}
                        {t.answer.text}
                      </div>
                      <Refs answer={t.answer} state={state} />
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
          <li ref={endRef} aria-hidden />
        </ol>
      )}
    </Screen>
  );
}
