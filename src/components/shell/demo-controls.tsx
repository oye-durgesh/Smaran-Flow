"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, CalendarPlus, FilePlus2, MessageCircleQuestion, Monitor, PillBottle, PlayCircle, RotateCcw, Smartphone, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { todayOf, confirmationOn } from "@/lib/selectors";
import { formatDayShort, formatTime, timeOf } from "@/lib/dates";
import { SmaranMark } from "@/components/smaran/brand";
import { Modal } from "@/components/smaran/modal";
import { Button } from "@/components/ui/button";

export function MobileWebToggle({ className }: { className?: string }) {
  const { mode, setMode, isNarrow } = useView();
  const options = [
    { value: "mobile" as const, label: "Mobile", icon: Smartphone },
    { value: "web" as const, label: "Web", icon: Monitor },
  ];
  return (
    <div role="radiogroup" aria-label="Presentation" className={cn("relative inline-grid grid-cols-2 rounded-full border border-line-strong bg-surface-raised p-1", className)}>
      <span
        aria-hidden
        className={cn("absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-peach transition-transform duration-300 ease-out", mode === "web" && "translate-x-full")}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          disabled={isNarrow && o.value === "web"}
          title={isNarrow && o.value === "web" ? "Open on a wider screen to see the web layout" : undefined}
          onClick={() => setMode(o.value)}
          className={cn("relative z-10 inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-colors disabled:opacity-40", mode === o.value ? "text-ink-strong" : "text-ink-muted hover:text-ink")}
        >
          <o.icon className="size-4" aria-hidden />
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DemoBar() {
  const { setDemoOpen, demoOpen, isNarrow } = useView();
  const { state } = useStore();
  return (
    <div className="no-print relative z-50 flex h-[56px] shrink-0 items-center justify-between gap-3 border-b border-line bg-surface-raised/90 px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <SmaranMark size={28} className="rounded-[9px]" />
        <div className="hidden min-w-0 leading-tight sm:block">
          <div className="text-[13px] font-extrabold text-ink-strong">SMARAN demo</div>
          <div className="truncate text-[11.5px] text-ink-muted">
            Demo clock · {formatDayShort(todayOf(state))} · {formatTime(timeOf(state.demoNow))}
          </div>
        </div>
      </div>
      {!isNarrow && <MobileWebToggle className="absolute left-1/2 -translate-x-1/2" />}
      <button
        type="button"
        onClick={() => setDemoOpen(!demoOpen)}
        aria-expanded={demoOpen}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-[13px] font-bold transition-colors",
          demoOpen ? "border-peach bg-peach-soft text-ink-strong" : "border-line-strong bg-surface-raised text-ink hover:border-peach",
        )}
      >
        <Sparkles className="size-4" aria-hidden /> Demo mode
      </button>
    </div>
  );
}

export function DemoPanel() {
  const { demoOpen, setDemoOpen, setIncomingReminderId, mode, setMode, isNarrow } = useView();
  const { state, resetDemo } = useStore();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!demoOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDemoOpen(false);
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [demoOpen, setDemoOpen]);

  const go = (href: string) => {
    setDemoOpen(false);
    router.push(href);
  };

  const confirmMedicine = () => {
    const today = todayOf(state);
    const candidates = state.reminders.filter((r) => r.kind === "medicine" && r.status === "active");
    const target =
      candidates.find((r) => r.familyMemberId === "mummy" && /bp/i.test(r.title) && !confirmationOn(r, today)) ??
      candidates.find((r) => !confirmationOn(r, today));
    setDemoOpen(false);
    if (!target) {
      toast("Every medicine is already confirmed today", { description: "Reset the demo to run the reminder again." });
      return;
    }
    router.push("/today");
    setIncomingReminderId(target.id);
  };

  const scenarios = [
    { icon: PillBottle, title: "Create medicine reminder", body: "Wispr Flow → “Mummy ko roz raat 9 baje BP ki medicine…”", run: () => go("/new?kind=reminder&demo=1") },
    { icon: BellRing, title: "Confirm medicine", body: "The 9 PM reminder reaches Mummy. She replies in chat.", run: confirmMedicine },
    { icon: CalendarPlus, title: "Create appointment", body: "“Mummy ka Dr Sharma ke saath Friday ko 11 baje…”", run: () => go("/new?kind=appointment&demo=1") },
    { icon: FilePlus2, title: "Upload health document", body: "Add a sample blood report and describe it.", run: () => go("/documents/upload?demo=1") },
    { icon: MessageCircleQuestion, title: "Ask about family health", body: "“Mummy ka latest blood report kab ka hai?”", run: () => go("/ask?demo=1") },
  ];

  if (!demoOpen) return null;
  return (
    <>
      <div className="no-print fixed inset-0 top-[56px] z-40 bg-[rgb(69_52_43/0.12)] animate-fade" onClick={() => setDemoOpen(false)} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Demo scenarios"
        className="no-print fixed top-[64px] right-3 z-50 w-[min(400px,calc(100vw-24px))] rounded-[26px] border border-line bg-surface-raised p-5 shadow-[var(--shadow-raised)] animate-rise sm:right-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[17px] font-extrabold text-ink-strong">Demo scenarios</div>
            <p className="text-[13px] text-ink-muted">Each one runs the real app flow on shared state.</p>
          </div>
          <button type="button" aria-label="Close demo panel" onClick={() => setDemoOpen(false)} className="inline-flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-ivory-deep">
            <X className="size-4" />
          </button>
        </div>

        <button type="button" onClick={() => go("/welcome")} className="mb-3 flex w-full items-center gap-3 rounded-[18px] bg-peach-soft/50 px-4 py-3 text-left transition-colors hover:bg-peach-soft">
          <PlayCircle className="size-6 text-peach-deep" aria-hidden />
          <span>
            <span className="block text-[14.5px] font-extrabold text-ink-strong">Start the full story</span>
            <span className="block text-[12.5px] text-ink-muted">Welcome → onboarding → Today</span>
          </span>
        </button>

        <ol className="space-y-1.5">
          {scenarios.map((s, i) => (
            <li key={s.title}>
              <button type="button" onClick={s.run} className="flex w-full items-start gap-3 rounded-[16px] px-3 py-2.5 text-left transition-colors hover:bg-ivory">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-sand/70 text-brown">
                  <s.icon className="size-[18px]" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-bold text-ink-strong">
                    {i + 1}. {s.title}
                  </span>
                  <span className="block truncate text-[12.5px] text-ink-muted">{s.body}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          {!isNarrow ? (
            <button type="button" onClick={() => setMode(mode === "mobile" ? "web" : "mobile")} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-ink hover:bg-ivory-deep">
              {mode === "mobile" ? <Monitor className="size-4" /> : <Smartphone className="size-4" />} Switch to {mode === "mobile" ? "Web" : "Mobile"}
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={() => setConfirmReset(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-ink-muted hover:bg-ivory-deep hover:text-ink">
            <RotateCcw className="size-4" aria-hidden /> Reset demo
          </button>
        </div>
      </div>
      <ResetDemoDialog open={confirmReset} onOpenChange={setConfirmReset} onConfirm={() => { resetDemo(); setDemoOpen(false); router.push("/today"); toast.success("Demo restored", { description: "Mummy, Papa, reminders, appointments and documents are back." }); }} />
    </>
  );
}

export function ResetDemoDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Reset the demo?"
      description="This restores Mummy and Papa, their reminders, appointments, documents and memory history. Anything you added will be cleared."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep my changes</Button>
          <Button onClick={() => { onOpenChange(false); onConfirm(); }}>Reset demo</Button>
        </>
      }
    />
  );
}
