"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircleQuestion, SearchX, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { answerQuestion, healthLabel, type Answer } from "@/lib/nlu";
import { memberById, todayOf } from "@/lib/selectors";
import { uid } from "@/lib/store/actions";
import type { AppState } from "@/lib/types";
import { Screen } from "@/components/shell/screen";
import { SmaranSpeakBox } from "@/components/smaran/smaran-speak-box";
import { AppointmentCard, DocumentCard, ReminderRow } from "@/components/smaran/cards";
import { SmaranMark } from "@/components/smaran/brand";
import { PageHeader, SectionLabel } from "@/components/smaran/primitives";

const SUGGESTIONS = [
  "Mummy ka latest blood report kab ka hai?",
  "Mummy ka BP kya tha?",
  "Papa ka sugar kitna tha?",
  "Papa ki next appointment kab hai?",
  "Mummy ki medicines kya hain?",
];

interface Turn {
  id: string;
  question: string;
  answer: Answer;
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
        if (ref.kind === "measurement") {
          const m = state.measurements.find((x) => x.id === ref.id);
          const who = m ? memberById(state, m.familyMemberId) : undefined;
          return m ? (
            <li key={ref.id} className="rounded-[16px] border border-line bg-surface-raised px-4 py-3">
              <div className="text-[15px] font-bold text-ink-strong">Source: {who?.name} · {healthLabel(m.kind)}</div>
              <div className="text-[13.5px] text-ink-muted">{m.value} {m.unit}{m.source === "sample" ? " · sample family note" : ""}</div>
            </li>
          ) : null;
        }
        const r = state.reminders.find((x) => x.id === ref.id);
        return r ? <li key={ref.id}><ReminderRow reminder={r} member={memberById(state, r.familyMemberId)} href={`/reminders/${r.id}`} /></li> : null;
      })}
    </ul>
  );
}

function resolve(question: string, state: AppState): Answer {
  try {
    return answerQuestion(question, state);
  } catch {
    return { found: false, refs: [], text: "Something went wrong while searching SMARAN. Try again." };
  }
}

export function AskScreen() {
  const params = useSearchParams();
  const { state } = useStore();
  const initialQ = params.get("q");
  const [turns, setTurns] = useState<Turn[]>(() => (initialQ ? [{ id: uid("q"), question: initialQ, answer: resolve(initialQ, state) }] : []));

  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const ask = (text: string) => {
    const answer = resolve(text, state);
    setTurns((all) => [...all, { id: uid("q"), question: text, answer }]);
  };

  return (
    <Screen
      width="narrow"
      footer={turns.length ? <SmaranSpeakBox context="ask" variant="composer" onQuestion={ask} /> : undefined}
      aside={
        <>
          <div>
            <SectionLabel>Try asking</SectionLabel>
            <ul className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => ask(s)} className="w-full rounded-[16px] border border-line bg-surface-raised px-4 py-3 text-left text-[14px] leading-snug text-ink transition-colors hover:border-peach">
                    “{s}”
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <p className="rounded-[18px] bg-sand/40 p-4 text-[13.5px] leading-relaxed text-ink">
            SMARAN only answers from what your family saved. Every answer links to its source. It doesn&apos;t give medical advice.
          </p>
        </>
      }
    >
      <PageHeader title="Ask SMARAN" subtitle="Search everything your family has saved." />
      {turns.length === 0 ? (
        <>
          <SmaranSpeakBox context="ask" onQuestion={ask} />
          <p className="mt-6 flex items-start gap-2 text-[13px] leading-snug text-ink-muted">
            <MessageCircleQuestion className="mt-0.5 size-4 shrink-0" aria-hidden />
            Answers come only from your family&apos;s saved memory.
          </p>
        </>
      ) : (
        <ol className="space-y-6" aria-live="polite">
          {turns.map((t) => (
            <li key={t.id} className="space-y-3">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-[20px] rounded-br-[6px] bg-peach px-4 py-3 text-[15.5px] font-semibold text-ink-strong">{t.question}</p>
              </div>
              <div className="flex items-start gap-2.5">
                <SmaranMark size={30} className="mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className={cn("rounded-[20px] rounded-tl-[6px] border px-4 py-3 text-[15.5px] leading-relaxed", t.answer.safety ? "border-waiting/30 bg-waiting-bg text-ink" : t.answer.found ? "border-line bg-surface-raised text-ink-strong" : "border-line bg-surface text-ink")}>
                    {t.answer.safety && <ShieldAlert className="mr-1.5 inline size-4 -translate-y-px text-waiting" aria-hidden />}
                    {!t.answer.found && !t.answer.safety && <SearchX className="mr-1.5 inline size-4 -translate-y-px text-ink-muted" aria-hidden />}
                    {t.answer.text}
                  </div>
                  <Refs answer={t.answer} state={state} />
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
