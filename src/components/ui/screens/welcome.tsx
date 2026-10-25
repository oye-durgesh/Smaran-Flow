"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { updateSettings } from "@/lib/store/actions";
import { SmaranLockup, SmaranMark, WisprFlowMark } from "@/components/smaran/brand";
import type { Language } from "@/lib/types";

function LanguageChoice() {
  const { state, update } = useStore();
  const options: { value: Language; label: string }[] = [
    { value: "en", label: "English" },
    { value: "hi", label: "हिन्दी" },
  ];
  return (
    <div role="radiogroup" aria-label="Language" className="inline-flex rounded-full border border-line-strong bg-surface-raised p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={state.settings.language === o.value}
          onClick={() => update((s) => updateSettings(s, { language: o.value }))}
          lang={o.value}
          className={cn("h-8 rounded-full px-4 text-[13px] font-bold transition-colors", state.settings.language === o.value ? "bg-sand text-ink-strong" : "text-ink-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A quiet, static glimpse of the core loop for the web welcome. */
function StoryPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[420px] space-y-4">
      <div className="rounded-[22px] border border-line-strong bg-surface-raised p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-2 text-[10px] font-extrabold tracking-[0.2em] text-ink-muted uppercase">Wispr Flow · Rahul</div>
        <div className="flex items-end gap-3">
          <p className="flex-1 text-[16px] leading-snug font-semibold text-ink-strong">“Mummy ko roz raat 9 baje BP ki medicine yaad dilani hai.”</p>
          <WisprFlowMark size={44} className="rounded-[14px]" />
        </div>
      </div>
      <div className="ml-8 rounded-[22px] border border-line bg-surface p-4">
        <div className="mb-2 text-[10px] font-extrabold tracking-[0.2em] text-ink-muted uppercase">SMARAN understood</div>
        <div className="grid grid-cols-2 gap-2 text-[14px]">
          {[["Person", "Mummy"], ["Reminder", "BP Medicine"], ["Time", "9:00 PM"], ["Frequency", "Every day"]].map(([k, v]) => (
            <div key={k} className="rounded-[12px] bg-ivory px-3 py-2">
              <div className="text-[10px] font-bold tracking-wider text-ink-muted uppercase">{k}</div>
              <div className="font-bold text-ink-strong">{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2 rounded-[22px] border border-line bg-surface-raised p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-end gap-2">
          <SmaranMark size={26} className="rounded-full" />
          <span className="rounded-[18px] rounded-bl-[6px] border border-line bg-surface px-3.5 py-2 text-[15px] font-semibold text-ink-strong">Mummy, medicine ka time ho gaya. 💊</span>
        </div>
        <div className="flex justify-end">
          <span className="rounded-[18px] rounded-br-[6px] bg-peach px-3.5 py-2 text-[15px] font-semibold text-ink-strong">Confirmed</span>
        </div>
        <div className="flex items-center justify-center gap-2 pt-1 text-[13px] font-bold text-confirmed">
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-confirmed text-white">
            <Check className="size-3" strokeWidth={3} />
          </span>
          BP Medicine · Confirmed at 9:07 PM
        </div>
      </div>
    </div>
  );
}

export function WelcomeScreen() {
  const { isWeb } = useView();

  if (isWeb) {
    return (
      <div className="flex min-h-full items-center">
        <div className="mx-auto grid w-full max-w-[1120px] grid-cols-2 items-center gap-16 px-12 py-12">
          <div className="animate-rise">
            <SmaranLockup width={176} />
            <h1 className="mt-10 text-[52px] leading-[1.08] font-extrabold tracking-tight text-ink-strong">
              Your voice remembers,
              <br />
              <span className="text-peach-deep">even when you can&apos;t be there.</span>
            </h1>
            <p className="mt-6 max-w-[460px] text-[18px] leading-relaxed text-ink-muted">
              SMARAN turns the way your family already talks into medicine reminders, appointments and a shared health memory — for parents who live far away.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/onboarding?step=1" className="inline-flex h-13 items-center rounded-[16px] bg-peach px-7 text-[16px] font-bold text-ink-strong transition-colors hover:bg-[#e29c7e]">
                Get started
              </Link>
              <Link href="/demo" className="inline-flex h-13 items-center rounded-[16px] border border-line-strong bg-surface-raised px-6 text-[16px] font-bold text-ink hover:bg-ivory-deep">
                Explore Demo
              </Link>
              <Link href="/demo?walkthrough=1" className="inline-flex h-13 items-center rounded-[16px] border border-line bg-ivory px-6 text-[16px] font-bold text-ink hover:bg-ivory-deep">
                Start Demo Walkthrough
              </Link>
            </div>
            <div className="mt-10">
              <LanguageChoice />
            </div>
          </div>
          <div className="animate-rise [animation-delay:120ms]">
            <StoryPreview />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(844px-64px)] flex-col px-7 pt-14 pb-10 md:min-h-[760px]">
      <div className="flex flex-1 flex-col items-center justify-center text-center animate-rise">
        <SmaranLockup width={168} />
        <p className="mt-10 text-[22px] leading-snug font-bold text-ink-strong">
          Your voice remembers,
          <br />
          even when you can&apos;t be there.
        </p>
      </div>
      <div className="space-y-3 animate-rise [animation-delay:150ms]">
        <Link href="/onboarding?step=1" className="flex h-14 w-full items-center justify-center rounded-[18px] bg-peach text-[17px] font-bold text-ink-strong transition-colors hover:bg-[#e29c7e]">
          Get started
        </Link>
        <Link href="/demo" className="flex h-12 w-full items-center justify-center rounded-[16px] border border-line-strong bg-surface-raised text-[15px] font-bold text-ink hover:bg-ivory-deep">
          Explore Demo
        </Link>
        <Link href="/demo?walkthrough=1" className="flex h-12 w-full items-center justify-center rounded-[16px] text-[15px] font-bold text-ink-muted hover:bg-ivory-deep">
          Start Demo Walkthrough
        </Link>
        <div className="flex justify-center pt-3">
          <LanguageChoice />
        </div>
      </div>
    </div>
  );
}
