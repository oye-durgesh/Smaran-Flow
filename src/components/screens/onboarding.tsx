"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, AudioLines, BellRing, Brain, Check, CheckCircle2, HeartHandshake, Leaf, MessageCircleHeart, Plus, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { addMember } from "@/lib/store/actions";
import { parseReminder, type ReminderDraft } from "@/lib/nlu";
import { todayOf } from "@/lib/selectors";
import type { Relationship } from "@/lib/types";
import { SmaranLogo } from "@/components/smaran/brand";
import { WisprFlowInput } from "@/components/smaran/wispr-flow-input";
import { ProcessingState } from "@/components/smaran/processing-state";
import { ReminderUnderstood } from "@/components/smaran/understood";
import { MemberAvatar } from "@/components/smaran/primitives";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const HERO_PHRASE = "Mummy ko roz raat 9 baje BP ki medicine yaad dilani hai.";
const TOTAL = 4;

function Shell({ step, children, aside, cta }: { step: number; children: ReactNode; aside?: ReactNode; cta: ReactNode }) {
  const { isWeb } = useView();
  const router = useRouter();
  const back = step === 1 ? "/welcome" : `/onboarding?step=${step - 1}`;
  const progress = (
    <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${TOTAL + 1}`}>
      {Array.from({ length: TOTAL + 1 }, (_, i) => (
        <span key={i} className={cn("h-1.5 rounded-full transition-all duration-500", i <= step ? "w-6 bg-peach" : "w-1.5 bg-line-strong")} />
      ))}
    </div>
  );
  const header = (
    <div className="flex items-center justify-between">
      <button type="button" onClick={() => router.push(back)} className="inline-flex h-9 items-center gap-1.5 rounded-[12px] px-2 text-sm font-semibold text-ink-muted hover:bg-ivory-deep" aria-label="Back">
        <ArrowLeft className="size-4" /> {isWeb && "Back"}
      </button>
      {progress}
      <Link href="/today" className="inline-flex h-9 items-center rounded-[12px] px-2 text-sm font-semibold text-ink-muted hover:bg-ivory-deep">
        Skip
      </Link>
    </div>
  );

  if (isWeb) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-[1120px] flex-col px-12 py-8">
        <div className="flex items-center justify-between">
          <SmaranLogo size="sm" />
          <div className="w-[360px]">{header}</div>
        </div>
        <div className="grid flex-1 grid-cols-[1fr_1fr] items-center gap-16 py-10">
          <div key={step} className="animate-rise">
            {children}
            <div className="mt-9 max-w-[360px]">{cta}</div>
          </div>
          <div key={`a${step}`} className="animate-rise [animation-delay:100ms]">{aside}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(844px-64px)] flex-col px-6 pt-3 pb-8">
      {header}
      <div key={step} className="flex-1 pt-8 animate-rise">
        {children}
        {aside && <div className="mt-7">{aside}</div>}
      </div>
      <div className="pt-6">{cta}</div>
    </div>
  );
}

function Title({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle: string }) {
  const { isWeb } = useView();
  return (
    <div>
      {eyebrow && <div className="mb-2 text-[12px] font-extrabold tracking-[0.16em] text-peach-deep uppercase">{eyebrow}</div>}
      <h1 className={cn("font-extrabold tracking-tight text-ink-strong", isWeb ? "text-[44px] leading-[1.1]" : "text-[30px] leading-tight")}>{title}</h1>
      <p className={cn("mt-3 text-ink-muted", isWeb ? "max-w-[480px] text-[18px] leading-relaxed" : "text-[16px]")}>{subtitle}</p>
    </div>
  );
}

function Cta({ href, label, onClick }: { href?: string; label: string; onClick?: () => void }) {
  const cls = "flex h-14 w-full items-center justify-center rounded-[18px] bg-peach text-[17px] font-bold text-ink-strong transition-colors hover:bg-[#e29c7e]";
  return href ? <Link href={href} className={cls}>{label}</Link> : <button type="button" onClick={onClick} className={cls}>{label}</button>;
}

/* ---------- Step 1: what SMARAN does ---------- */

function WhatStep() {
  const ideas = [
    { icon: HeartHandshake, title: "Family Connection", body: "Always together, always cared for" },
    { icon: AudioLines, title: "Memory Through Voice", body: "Conversations that remember" },
    { icon: Leaf, title: "Peace of Mind", body: "Because they matter, always" },
  ];
  const list = (
    <ul className="space-y-3">
      {ideas.map((idea) => (
        <li key={idea.title} className="flex items-center gap-4 rounded-[20px] border border-line bg-surface-raised p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-peach-soft/70 text-peach-deep">
            <idea.icon className="size-6" aria-hidden />
          </span>
          <span>
            <span className="block text-[17px] font-bold text-ink-strong">{idea.title}</span>
            <span className="block text-[14.5px] text-ink-muted">{idea.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <Shell step={1} aside={list} cta={<Cta href="/onboarding?step=2" label="Continue" />}>
      <Title eyebrow="What is SMARAN?" title="Your family's health, remembered." subtitle="A quiet layer of care. Medicines, appointments, reports and important health details — kept together in one place." />
    </Shell>
  );
}

/* ---------- Step 2: Wispr Flow ---------- */

function WisprStep() {
  const { state } = useStore();
  const [phase, setPhase] = useState<"input" | "processing" | "done">("input");
  const [draft, setDraft] = useState<ReminderDraft | null>(null);
  const finish = useCallback(() => setPhase("done"), []);

  const demo = (
    <div className="space-y-4">
      {phase === "input" && (
        <WisprFlowInput
          primary
          placeholder="Tell SMARAN what your family needs to remember..."
          examples={[HERO_PHRASE]}
          onSubmit={(text) => {
            setDraft(parseReminder(text, state.family, todayOf(state)));
            setPhase("processing");
          }}
        />
      )}
      {phase === "processing" && draft && (
        <ProcessingState transcript={draft.transcript} steps={["Reading your words", "Aligning the details", "Understanding the reminder"]} stepMs={480} onDone={finish} />
      )}
      {phase === "done" && draft && (
        <div className="animate-rise">
          <blockquote className="mb-4 rounded-[20px] border border-line bg-surface px-5 py-4 text-[16px] font-semibold text-ink-strong">“{draft.transcript}”</blockquote>
          <div className="mb-3 flex items-center gap-2 text-[12px] font-extrabold tracking-[0.16em] text-ink-muted uppercase">
            <CheckCircle2 className="size-4 text-confirmed" aria-hidden /> SMARAN understood
          </div>
          <ReminderUnderstood draft={draft} family={state.family} />
          <button type="button" onClick={() => setPhase("input")} className="mt-4 text-[14px] font-bold text-peach-deep hover:underline">
            Try another sentence
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Shell step={2} aside={demo} cta={<Cta href="/onboarding?step=3" label="Continue" />}>
      <Title eyebrow="Wispr Flow" title="Just say it." subtitle="You don't need to fill complicated forms. Use Wispr Flow to tell SMARAN what your family needs to remember." />
    </Shell>
  );
}

/* ---------- Step 3: How it works ---------- */

function HowStep() {
  const { isWeb } = useView();
  const steps = [
    { icon: AudioLines, title: "You speak", body: "Say it the way you'd tell family." },
    { icon: Brain, title: "SMARAN understands", body: "Who, what, when — pulled out for you to check." },
    { icon: MessageCircleHeart, title: "SMARAN remembers", body: "Saved into your family's memory." },
    { icon: BellRing, title: "Your family gets reminded", body: "A gentle message at the right time." },
    { icon: Check, title: "They confirm", body: "“Haan, le li.” You see it instantly." },
  ];
  const flow = (
    <ol className={cn("relative", isWeb ? "space-y-3" : "space-y-2.5")}>
      {steps.map((s, i) => (
        <li key={s.title} className="flex items-center gap-4 rounded-[20px] border border-line bg-surface-raised p-4 animate-rise" style={{ animationDelay: `${i * 70}ms` }}>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sand text-brown">
            <s.icon className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[16.5px] font-bold text-ink-strong">
              <span className="mr-1.5 text-ink-muted">{i + 1}.</span>
              {s.title}
            </span>
            <span className="block text-[14px] text-ink-muted">{s.body}</span>
          </span>
        </li>
      ))}
    </ol>
  );
  return (
    <Shell step={3} aside={flow} cta={<Cta href="/onboarding?step=4" label="Continue" />}>
      <Title eyebrow="How SMARAN works" title="SMARAN remembers the details." subtitle="Speak → Understand → Remember → Remind → Confirm. And then it remembers again." />
    </Shell>
  );
}

/* ---------- Step 4: Family ---------- */

const ADDABLE: { label: string; relationship: Relationship; icon: typeof Users }[] = [
  { label: "Grandparent", relationship: "Grandmother", icon: UserRound },
  { label: "Partner", relationship: "Partner", icon: HeartHandshake },
  { label: "Other", relationship: "Other", icon: Users },
];

function FamilyStep() {
  const { state, update, commit } = useStore();
  const router = useRouter();
  const [adding, setAdding] = useState<Relationship | null>(null);
  const [form, setForm] = useState({ name: "", age: "", phone: "" });
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!adding) return;
    if (!form.name.trim()) return setError("Add a name so SMARAN knows who this is.");
    const age = form.age ? Number(form.age) : undefined;
    if (age !== undefined && (Number.isNaN(age) || age < 1 || age > 120)) return setError("That age doesn't look right.");
    commit((s) => addMember(s, { name: form.name, relationship: adding, age, phone: form.phone }));
    setAdding(null);
    setForm({ name: "", age: "", phone: "" });
    setError(null);
  };

  const start = () => {
    update((s) => ({ ...s, onboarded: true }));
    router.push("/today");
  };

  const cards = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {state.family.map((m) => (
          <div key={m.id} className="relative rounded-[20px] border-2 border-peach bg-peach-soft/30 p-4">
            <span className="absolute top-3 right-3 inline-flex size-6 items-center justify-center rounded-full bg-peach text-ink-strong">
              <Check className="size-3.5" strokeWidth={3} aria-hidden />
            </span>
            <MemberAvatar member={m} size={44} />
            <div className="mt-3 text-[17px] font-extrabold text-ink-strong">{m.name}</div>
            <div className="text-[13px] text-ink-muted">
              {m.relationship}
              {m.age ? ` · ${m.age}` : ""}
            </div>
          </div>
        ))}
        {ADDABLE.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => {
              setAdding(a.relationship);
              setForm({ name: a.label === "Other" ? "" : a.label === "Partner" ? "" : "Dadi", age: "", phone: "" });
            }}
            aria-pressed={adding === a.relationship}
            className={cn("rounded-[20px] border-2 border-dashed p-4 text-left transition-colors", adding === a.relationship ? "border-peach bg-surface-raised" : "border-line-strong bg-surface/60 hover:border-peach")}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-ivory-deep text-brown">
              <a.icon className="size-5" aria-hidden />
            </span>
            <div className="mt-3 text-[17px] font-extrabold text-ink-strong">{a.label}</div>
            <div className="inline-flex items-center gap-1 text-[13px] font-semibold text-peach-deep">
              <Plus className="size-3.5" aria-hidden /> Add
            </div>
          </button>
        ))}
      </div>

      {adding && (
        <div className="rounded-[20px] border border-line bg-surface-raised p-4 animate-rise">
          <div className="mb-3 text-[15px] font-bold text-ink-strong">Add someone else</div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ob-name">Name</Label>
              <Input id="ob-name" value={form.name} autoFocus placeholder="e.g. Dadi" onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!error && !form.name.trim()} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ob-age">Age (optional)</Label>
                <Input id="ob-age" inputMode="numeric" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value.replace(/\D/g, "") })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-phone">Phone (optional)</Label>
                <Input id="ob-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            {error && <p role="alert" className="text-[13px] font-semibold text-missed">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button onClick={save}>Add to family</Button>
              <Button variant="ghost" onClick={() => { setAdding(null); setError(null); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Shell
      step={4}
      aside={cards}
      cta={
        <div className="space-y-2">
          <Cta onClick={start} label="Start using SMARAN" />
          <button type="button" onClick={start} className="flex h-11 w-full items-center justify-center rounded-[14px] text-[14.5px] font-bold text-ink-muted hover:bg-ivory-deep">
            I&apos;ll add family later
          </button>
        </div>
      }
    >
      <Title eyebrow="Family setup" title="Who are you remembering for?" subtitle="Mummy and Papa are already here with sample details so you can explore. Add anyone else you care for." />
    </Shell>
  );
}

export function OnboardingScreen() {
  const step = Number(useSearchParams().get("step") ?? "1");
  if (step === 2) return <WisprStep />;
  if (step === 3) return <HowStep />;
  if (step === 4) return <FamilyStep />;
  return <WhatStep />;
}
