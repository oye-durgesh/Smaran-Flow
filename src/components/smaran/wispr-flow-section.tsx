"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WisprFlowComposer } from "./wispr-flow-composer";
import { evaluateSectionPolicy, type WisprSectionId } from "@/lib/wispr-flow-context";
import { requestInterpretation, primaryAction } from "@/lib/interpret/client";
import { useStore } from "@/lib/store/store";
import { classifySmaranIntent } from "@/lib/nlu/intents";
import type { ProposedAction } from "@/lib/interpret/zod";
import { captureOnToday, reminderReceipt } from "@/lib/store/today-capture";
import { createCloudReminder, isUuid } from "@/lib/store/cloud";
import { deleteReminder } from "@/lib/store/actions";
import { memberById } from "@/lib/selectors";

export function WisprFlowSection({
  context,
  careRecipientId,
  onCapture,
  compact,
  className,
}: {
  context: WisprSectionId;
  careRecipientId?: string;
  onCapture?: (text: string, action: ProposedAction) => void | string | Promise<void | string>;
  compact?: boolean;
  className?: string;
}) {
  const { state, session, commit, refreshVault } = useStore();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; href?: string; hrefLabel?: string } | null>(null);
  const [pending, setPending] = useState<ProposedAction | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);

  const persistReminder = async (text: string): Promise<string | void> => {
    const out = commit((s) => {
      const captured = captureOnToday(s, text);
      return [captured.next, captured.result];
    });
    if (!out.ok) {
      setNotice({ message: out.error });
      return out.error;
    }
    if (session.authenticated && out.recipientId && isUuid(out.recipientId) && out.time && out.recurrence) {
      try {
        await createCloudReminder({
          recipientId: out.recipientId,
          title: out.title,
          kind: out.reminderKind ?? "other",
          time: out.time,
          date: out.date,
          recurrence: out.recurrence,
        });
        await refreshVault();
      } catch (e) {
        return e instanceof Error ? e.message : "Cloud save failed. The local demo reminder is still here.";
      }
    }
    const who = memberById(state, out.recipientId ?? "")?.name ?? out.recipientId;
    setUndoId(out.id);
    setNotice({
      message: reminderReceipt(out, who),
      href: out.href,
      hrefLabel: "Open reminder",
    });
    toast.success("Reminder created");
  };

  const onSubmit = async (text: string): Promise<string | void> => {
    setNotice(null);
    setPending(null);
    setBusy(true);
    try {
      const localIntent = classifySmaranIntent(text);
      const reminderIntent = localIntent === "medicine_reminder" || localIntent === "health_check_reminder" || localIntent === "pickup_reminder";
      const demoMode = Boolean(state.settings.demoWorkspace || session.isDemo);

      if (reminderIntent) {
        const result = await requestInterpretation(text, state, context === "medicines" ? "medicine_reminder" : "general_reminder");
        const action = primaryAction(result);
        if (action.clarificationQuestion || action.missingFields.length) {
          setNotice({ message: action.clarificationQuestion || "I need a missing detail before anything is saved." });
          return;
        }
        if (demoMode) return await persistReminder(text);
        setPending(action);
        return;
      }

      const gate = evaluateSectionPolicy(context, localIntent, text);
      if (!gate.allowed) {
        setNotice({ message: gate.message, href: gate.href, hrefLabel: gate.hrefLabel });
        return;
      }
      const result = await requestInterpretation(text, state, context === "appointments" ? "appointment" : context === "medicines" ? "medicine_reminder" : context === "documents" ? "document" : context === "ask" ? "ask" : context === "health-card" ? "health_update" : "general_reminder");
      const action = primaryAction(result);
      const parsedGate = evaluateSectionPolicy(context, action.intent, text);
      if (!parsedGate.allowed) {
        setNotice({ message: parsedGate.message, href: parsedGate.href, hrefLabel: parsedGate.hrefLabel });
        return;
      }
      if (action.clarificationQuestion || action.missingFields.length) {
        setNotice({ message: action.clarificationQuestion || "I need a missing detail before anything is saved." });
        return;
      }
      if (action.requiresConfirmation && (action.intent === "appointment_create_or_update" || action.intent === "medicine_reminder" || action.intent === "health_measurement")) {
        setPending(action);
        return;
      }
      if (onCapture) return await onCapture(text, action);
      setNotice({ message: "I understood that, but this section only confirms through the existing form." });
    } catch {
      return "Interpretation failed. Your text is still here.";
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <WisprFlowComposer context={context} careRecipientId={careRecipientId} isLoading={busy} compact={compact} onSubmit={onSubmit} />
      {notice && (
        <div role="status" className="mt-3 rounded-[16px] border border-line bg-sand/40 px-4 py-3 text-[14px] font-semibold whitespace-pre-line text-ink">
          <p>{notice.message}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {notice.href && notice.hrefLabel && (
              <Link href={notice.href} className="inline-flex h-9 items-center rounded-full bg-peach px-3 text-[13px] font-bold text-ink-strong">
                {notice.hrefLabel}
              </Link>
            )}
            {undoId && (
              <Button
                variant="outline"
                onClick={() => {
                  commit((s) => [deleteReminder(s, undoId), undefined]);
                  setUndoId(null);
                  setNotice({ message: "Reminder undone. Nothing else was changed." });
                }}
              >
                Undo
              </Button>
            )}
          </div>
        </div>
      )}
      {pending && (
        <div className="mt-3 rounded-[20px] border border-peach bg-peach-soft/30 p-4" role="dialog" aria-label="Confirm request">
          <p className="text-[15px] font-bold text-ink-strong">Confirm before SMARAN saves anything</p>
          <p className="mt-1 text-[13.5px] text-ink">{pending.transcript}</p>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            {pending.intent.replace(/_/g, " ")}
            {pending.memberName ? ` · ${pending.memberName}` : ""}
            {careRecipientId ? ` · scoped to this person` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                const reminderIntent = pending.intent === "medicine_reminder" || pending.intent === "health_check_reminder" || pending.intent === "pickup_reminder";
                if (reminderIntent) {
                  const out = await persistReminder(pending.transcript);
                  if (typeof out === "string") toast.error(out);
                  setPending(null);
                  return;
                }
                if (!onCapture) {
                  setPending(null);
                  return;
                }
                const out = await onCapture(pending.transcript, pending);
                if (typeof out === "string") toast.error(out);
                else setPending(null);
              }}
            >
              Confirm
            </Button>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
