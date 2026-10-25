"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useStore } from "@/lib/store/store";
import { healthLabel, type HealthDraft } from "@/lib/nlu";
import { primaryAction, requestInterpretation } from "@/lib/interpret/client";
import type { InterpretSession } from "@/lib/interpret/schema";
import type { ProposedAction } from "@/lib/interpret/zod";
import { setAppointmentStatus, updateAppointment, updateMember, upsertMeasurement } from "@/lib/store/actions";
import { createCloudMeasurement, isUuid, patchAppointment } from "@/lib/store/cloud";
import { latestMeasurement, memberById, todayOf } from "@/lib/selectors";
import { formatLong } from "@/lib/dates";
import { promptsFor, speakCopy, type SpeakContext } from "@/lib/speak-prompts";
import { Button } from "@/components/ui/button";
import { WisprFlowInput } from "./wispr-flow-input";

export type { SpeakContext };

function sessionOf(context: SpeakContext): InterpretSession {
  if (context === "ask") return "ask";
  if (context === "documents") return "document";
  if (context === "appointments") return "appointment";
  if (context === "family") return "family";
  if (typeof context === "object") return "health_update";
  return "general_reminder";
}

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
  const { state, session, update, commit, refreshVault } = useStore();
  const [pendingHealth, setPendingHealth] = useState<HealthDraft | null>(null);
  const [pendingFact, setPendingFact] = useState<ProposedAction | null>(null);
  const [pendingAppt, setPendingAppt] = useState<ProposedAction | null>(null);
  const [clarify, setClarify] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const c = speakCopy(context);
  const examples = promptsFor(context);

  const onSubmit = async (text: string): Promise<string | void> => {
    setSaved(null);
    setClarify(null);
    setPendingFact(null);
    setPendingAppt(null);
    setBusy(true);
    try {
      const result = await requestInterpretation(text, state, sessionOf(context));
      const action = primaryAction(result);
      const intent = action.intent;
      if (result.actions.length > 1) {
        setClarify(`I found ${result.actions.length} requests. Reviewing the first: ${intent.replace(/_/g, " ")}.`);
      }

      if (intent === "unknown") {
        setClarify(action.clarificationQuestion || "I need a clearer request before I create anything.");
        return;
      }
      if (intent === "health_measurement") {
        if (action.clarificationQuestion || !action.memberId || !action.measurementKind || !action.measurementValue) {
          setClarify(action.clarificationQuestion || "I need the person, type and value before saving a measurement.");
          return;
        }
        setPendingHealth({
          transcript: text,
          memberId: action.memberId,
          kind: action.measurementKind,
          value: action.measurementValue,
          unit: action.unit,
        });
        return;
      }
      if (intent === "family_fact" && action.familyAge && action.memberId) {
        setPendingFact(action);
        return;
      }
      if (intent === "ask_question" || intent === "document_question" || context === "documents" || context === "ask") {
        if (onQuestion) onQuestion(text);
        else router.push(`/ask?q=${encodeURIComponent(text)}`);
        return;
      }
      if (intent === "appointment_complete" || intent === "appointment_cancel" || intent === "appointment_reschedule") {
        if (action.missingFields.includes("matchedRecordId") || !action.matchedAppointmentIds?.length) {
          setClarify(action.clarificationQuestion || "Which existing appointment? I will not create a new one.");
          return;
        }
        if (action.matchedAppointmentIds.length > 1) {
          const names = action.matchedAppointmentIds
            .map((id) => state.appointments.find((a) => a.id === id))
            .filter(Boolean)
            .map((a) => `${a!.doctor} · ${a!.date} ${a!.time}`)
            .join("; ");
          setClarify(`Which appointment? ${names || "More than one upcoming visit matches."} I will not pick one for you.`);
          return;
        }
        setPendingAppt(action);
        return;
      }
      if (onCapture) {
        onCapture(text);
        return;
      }
      const kind =
        intent === "appointment_create_or_update"
          ? "appointment"
          : intent === "pickup_reminder"
            ? "pickup"
            : intent === "health_check_reminder"
              ? "check"
              : intent === "medicine_reminder"
                ? "medicine"
                : "reminder";
      if (intent === "after_visit_note") {
        setClarify(action.clarificationQuestion || "Saved notes need a person and confirmation. Open Memory after you confirm a visit note in review.");
        router.push(`/new?kind=reminder&text=${encodeURIComponent(text)}`);
        return;
      }
      router.push(`/new?kind=${kind}&text=${encodeURIComponent(text)}`);
    } catch {
      return "Interpretation failed. Your text is still here — try again.";
    } finally {
      setBusy(false);
    }
  };

  const saveHealth = async () => {
    if (!pendingHealth?.memberId || !pendingHealth.kind || !pendingHealth.value) return;
    setBusy(true);
    try {
      const who = memberById(state, pendingHealth.memberId);
      if (session.authenticated && isUuid(pendingHealth.memberId)) {
        await createCloudMeasurement({
          recipientId: pendingHealth.memberId,
          kind: pendingHealth.kind,
          value: pendingHealth.value,
          unit: pendingHealth.unit ?? "",
          sourceType: "wispr",
        });
        const ok = await refreshVault();
        if (!ok) throw new Error("Saved, but the vault did not refresh.");
      } else {
        commit((s) => upsertMeasurement(s, { familyMemberId: pendingHealth.memberId!, kind: pendingHealth.kind!, value: pendingHealth.value!, unit: pendingHealth.unit ?? "", source: "wispr" }));
      }
      setSaved(`Saved to ${who?.name}'s health card.`);
      setPendingHealth(null);
      toast.success(`Saved to ${who?.name}'s health card.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't update this health record. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const saveFact = () => {
    if (!pendingFact?.memberId || !pendingFact.familyAge) return;
    update((s) => updateMember(s, pendingFact.memberId!, { age: pendingFact.familyAge }));
    setSaved(`Updated ${pendingFact.memberName}'s age.`);
    setPendingFact(null);
  };

  const applyAppt = async () => {
    const result = pendingAppt;
    if (!result?.matchedAppointmentIds?.[0]) return;
    if (result.matchedAppointmentIds.length > 1) {
      setClarify("Which appointment? I will not pick one for you.");
      return;
    }
    const id = result.matchedAppointmentIds[0];
    try {
      if (session.authenticated && isUuid(id)) {
        if (result.intent === "appointment_reschedule") {
          if (!result.date || !result.time) {
            setClarify("I need the new date and time.");
            return;
          }
          await patchAppointment(id, "reschedule", { date: result.date, time: result.time });
        } else {
          await patchAppointment(id, result.intent === "appointment_complete" ? "complete" : "cancel");
        }
        const ok = await refreshVault();
        if (!ok) throw new Error("The server saved the change, but the vault did not refresh.");
      } else {
        if (result.intent === "appointment_complete") update((s) => setAppointmentStatus(s, id, "completed"));
        else if (result.intent === "appointment_cancel") update((s) => setAppointmentStatus(s, id, "cancelled"));
        else if (result.intent === "appointment_reschedule") {
          if (!result.date || !result.time) {
            setClarify("I need the new date and time.");
            return;
          }
          update((s) => updateAppointment(s, id, { date: result.date, time: result.time }));
        }
      }
      toast.success(result.intent === "appointment_complete" ? "Appointment marked completed" : result.intent === "appointment_cancel" ? "Appointment cancelled" : "Appointment rescheduled");
      setPendingAppt(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The appointment was not changed.");
    }
  };

  const member = pendingHealth ? memberById(state, pendingHealth.memberId) : undefined;
  const previous = pendingHealth?.memberId && pendingHealth.kind ? latestMeasurement(state, pendingHealth.memberId, pendingHealth.kind) : undefined;
  const appt = pendingAppt?.matchedAppointmentIds?.[0] ? state.appointments.find((a) => a.id === pendingAppt.matchedAppointmentIds![0]) : undefined;

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
        busyLabel="Working on what you wrote…"
        onSubmit={onSubmit}
      />
      {clarify && (
        <p role="status" className="mt-3 rounded-[16px] border border-line bg-sand/40 px-4 py-3 text-[14.5px] font-semibold text-ink">
          {clarify}
        </p>
      )}
      {pendingHealth && pendingHealth.kind && pendingHealth.value && (
        <div className="mt-3 rounded-[20px] border border-peach bg-peach-soft/30 p-4" role="dialog" aria-label="Confirm measurement">
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-ink-muted uppercase">SMARAN understood</p>
          <p className="mt-2 text-[13.5px] italic text-ink-muted">“{pendingHealth.transcript}”</p>
          <div className="mt-3">
            <div className="text-[20px] font-extrabold text-ink-strong">{member?.name}</div>
            <div className="text-[14px] text-ink-muted">{healthLabel(pendingHealth.kind)}</div>
            <div className="mt-1 text-[26px] font-extrabold text-ink-strong">
              {pendingHealth.kind === "blood_pressure" ? pendingHealth.value!.replace("/", " / ") : pendingHealth.value}{" "}
              <span className="text-[16px] font-bold text-ink-muted">{pendingHealth.unit}</span>
            </div>
            {previous && previous.value !== pendingHealth.value && (
              <p className="mt-1 text-[13px] text-ink-muted">
                Was {previous.value} {previous.unit} → now {pendingHealth.value} {pendingHealth.unit}
              </p>
            )}
            <div className="text-[13px] text-ink-muted">{formatLong(todayOf(state))}</div>
          </div>
          <p className="mt-3 text-[15px] font-bold text-ink-strong">Save to {member?.name}&apos;s health card?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={saveHealth} disabled={busy}>Confirm</Button>
            <Button variant="outline" onClick={() => setPendingHealth(null)}>Edit</Button>
            <Button variant="ghost" onClick={() => setPendingHealth(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {pendingFact && (
        <div className="mt-3 rounded-[20px] border border-peach bg-peach-soft/30 p-4" role="dialog">
          <p className="text-[15px] font-bold text-ink-strong">
            Save {pendingFact.memberName}&apos;s age as {pendingFact.familyAge}?
          </p>
          <p className="mt-1 text-[13px] text-ink-muted">This is a family-reported fact, not a clinical record.</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={saveFact}>Confirm</Button>
            <Button variant="outline" onClick={() => setPendingFact(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {pendingAppt && appt && (
        <div className="mt-3 rounded-[20px] border border-peach bg-peach-soft/30 p-4" role="dialog">
          <p className="text-[15px] font-bold text-ink-strong">
            {pendingAppt.intent === "appointment_complete" && `Mark ${appt.doctor} (${memberById(state, appt.familyMemberId)?.name}) completed?`}
            {pendingAppt.intent === "appointment_cancel" && `Cancel ${appt.doctor} on ${appt.date}?`}
            {pendingAppt.intent === "appointment_reschedule" && `Move ${appt.doctor} to ${pendingAppt.date} ${pendingAppt.time ?? appt.time}?`}
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={applyAppt}>Confirm</Button>
            <Button variant="outline" onClick={() => setPendingAppt(null)}>Cancel</Button>
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
