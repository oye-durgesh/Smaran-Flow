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
  const { state } = useStore();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; href?: string; hrefLabel?: string } | null>(null);
  const [pending, setPending] = useState<ProposedAction | null>(null);

  const onSubmit = async (text: string): Promise<string | void> => {
    setNotice(null);
    setPending(null);
    setBusy(true);
    try {
      const localIntent = classifySmaranIntent(text);
      const gate = evaluateSectionPolicy(context, localIntent);
      if (!gate.allowed) {
        setNotice({ message: gate.message, href: gate.href, hrefLabel: gate.hrefLabel });
        return;
      }
      const result = await requestInterpretation(text, state, context === "appointments" ? "appointment" : context === "medicines" ? "medicine_reminder" : context === "documents" ? "document" : context === "ask" ? "ask" : context === "health-card" ? "health_update" : "general_reminder");
      const action = primaryAction(result);
      const parsedGate = evaluateSectionPolicy(context, action.intent);
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
        <div role="status" className="mt-3 rounded-[16px] border border-line bg-sand/40 px-4 py-3 text-[14px] font-semibold text-ink">
          <p>{notice.message}</p>
          {notice.href && notice.hrefLabel && (
            <Link href={notice.href} className="mt-2 inline-flex h-9 items-center rounded-full bg-peach px-3 text-[13px] font-bold text-ink-strong">
              {notice.hrefLabel}
            </Link>
          )}
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
                if (!onCapture) {
                  setPending(null);
                  return;
                }
                const out = await onCapture(pending.transcript, pending);
                if (typeof out === "string") toast.error(out);
                else {
                  toast.success("Saved.");
                  setPending(null);
                }
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
