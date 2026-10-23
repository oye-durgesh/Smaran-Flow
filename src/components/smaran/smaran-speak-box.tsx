"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useStore } from "@/lib/store/store";
import { parseSmaranCommand, healthLabel, type HealthDraft } from "@/lib/nlu";
import { upsertMeasurement } from "@/lib/store/actions";
import { latestMeasurement, memberById, todayOf } from "@/lib/selectors";
import { formatLong } from "@/lib/dates";
import { promptsFor, speakCopy, type SpeakContext } from "@/lib/speak-prompts";
import { Button } from "@/components/ui/button";
import { WisprFlowInput } from "./wispr-flow-input";

export type { SpeakContext };

export function SmaranSpeakBox({
  context = "general",
  placeholder,
  variant = "card",
  className,
  onQuestion,
  onCapture,
}: {
  context?: SpeakContext;
  placeholder?: string;
  variant?: "card" | "composer";
  className?: string;
  onQuestion?: (text: string) => void;
  onCapture?: (text: string) => void;
}) {
  const router = useRouter();
  const { state, commit } = useStore();
  const [pending, setPending] = useState<HealthDraft | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const c = speakCopy(context);
  const examples = promptsFor(context);

  const onSubmit = (text: string): string | void => {
    setSaved(null);
    const cmd = parseSmaranCommand(text, state);
    if (cmd.intent === "health" && cmd.health) {
      const h = cmd.health;
      if (!h.memberId) return "Which person should I update — Mummy or Papa?";
      if (!h.kind) return "I couldn't tell if this is blood pressure, sugar, heart rate or weight.";
      if (h.incomplete === "bp_systolic_only") return "Did you mean a complete blood pressure, like 128/82?";
      if (!h.value) return "I heard the type, but not a value. Try “Papa ka sugar aaj 118 tha.”";
      setPending(h);
      return;
    }
    if (cmd.intent === "question" || context === "documents" || context === "ask") {
      if (onQuestion) onQuestion(cmd.text);
      else router.push(`/ask?q=${encodeURIComponent(cmd.text)}`);
      return;
    }
    if (onCapture) {
      onCapture(cmd.text);
      return;
    }
    router.push(`/new?kind=${cmd.intent}&text=${encodeURIComponent(cmd.text)}`);
  };

  const save = () => {
    if (!pending?.memberId || !pending.kind || !pending.value) return;
    setBusy(true);
    try {
      const who = memberById(state, pending.memberId);
      commit((s) => upsertMeasurement(s, { familyMemberId: pending.memberId!, kind: pending.kind!, value: pending.value!, unit: pending.unit ?? "", source: "wispr" }));
      setSaved(`Saved to ${who?.name}'s health card.`);
      setPending(null);
      toast.success(`Saved to ${who?.name}'s health card.`);
    } catch {
      toast.error("We couldn't update this health record. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const member = pending ? memberById(state, pending.memberId) : undefined;
  const previous = pending?.memberId && pending.kind ? latestMeasurement(state, pending.memberId, pending.kind) : undefined;

  return (
    <div className={className}>
      <WisprFlowInput
        primary
        variant={variant}
        placeholder={placeholder ?? c.placeholder}
        support={c.helper}
        examples={examples}
        examplesAction="fill"
        busy={busy}
        busyLabel="Got it. Organizing this for you…"
        onSubmit={onSubmit}
      />
      {pending && pending.kind && pending.value && (
        <div className="mt-3 rounded-[20px] border border-peach bg-peach-soft/30 p-4" role="dialog" aria-label="Confirm measurement">
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-ink-muted uppercase">SMARAN understood</p>
          <p className="mt-2 text-[13.5px] italic text-ink-muted">“{pending.transcript}”</p>
          <div className="mt-3">
            <div className="text-[20px] font-extrabold text-ink-strong">{member?.name}</div>
            <div className="text-[14px] text-ink-muted">{healthLabel(pending.kind)}</div>
            <div className="mt-1 text-[26px] font-extrabold text-ink-strong">
              {pending.kind === "blood_pressure" ? pending.value!.replace("/", " / ") : pending.value}{" "}
              <span className="text-[16px] font-bold text-ink-muted">{pending.unit}</span>
            </div>
            {previous && previous.value !== pending.value && (
              <p className="mt-1 text-[13px] text-ink-muted">
                Was {previous.value} {previous.unit} → now {pending.value} {pending.unit}
              </p>
            )}
            <div className="text-[13px] text-ink-muted">{formatLong(todayOf(state))}</div>
          </div>
          <p className="mt-3 text-[15px] font-bold text-ink-strong">Save to {member?.name}&apos;s health card?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={save} disabled={busy}>Confirm</Button>
            <Button variant="outline" onClick={() => setPending(null)}>Edit</Button>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {saved && (
        <p role="status" className="mt-3 rounded-[16px] bg-confirmed-bg px-4 py-3 text-[14.5px] font-bold text-confirmed">
          {saved}
        </p>
      )}
    </div>
  );
}
