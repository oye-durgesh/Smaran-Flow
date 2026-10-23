"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight, Download, Eraser, Lock, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { setDemoTime, updateSettings } from "@/lib/store/actions";
import { timeOf } from "@/lib/dates";
import type { Settings } from "@/lib/types";
import { Screen } from "@/components/shell/screen";
import { ResetDemoDialog } from "@/components/shell/demo-controls";
import { WisprFlowMark } from "@/components/smaran/brand";
import { MemberAvatar, PageHeader, PillGroup, SectionLabel, Surface } from "@/components/smaran/primitives";
import { Modal } from "@/components/smaran/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

function Row({ title, body, control, htmlFor }: { title: string; body?: ReactNode; control: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-[15.5px] font-bold text-ink-strong">{title}</label>
        {body && <p className="mt-0.5 text-[13.5px] leading-snug text-ink-muted">{body}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <Surface className="divide-y divide-line">{children}</Surface>
    </section>
  );
}

export function SettingsScreen() {
  const { state, update, resetDemo, clearAll } = useStore();
  const { isWeb } = useView();
  const [name, setName] = useState(state.user.name);
  const [resetting, setResetting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const s = state.settings;
  const set = (patch: Partial<Settings>) => update((st) => updateSettings(st, patch));

  const exportData = () => {
    const payload = { exportedFrom: "SMARAN prototype", note: "Documents are listed by name only; files stay in this browser.", ...state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smaran-family-memory-${state.demoNow.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Family memory exported");
  };

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === state.user.name) return setName(state.user.name);
    update((st) => ({ ...st, user: { name: trimmed } }));
    toast.success("Name updated");
  };

  return (
    <Screen width="narrow">
      <PageHeader title="Settings" subtitle="Your family, your language, your data." />
      <div className={cn("space-y-7", isWeb && "pb-6")}>
        <Group label="Profile">
          <div className="space-y-1.5 px-5 py-4">
            <Label htmlFor="s-name">Your name</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
            <p className="text-[12.5px] text-ink-muted">Used when SMARAN tells your family who set a reminder.</p>
          </div>
        </Group>

        <Group label="Family">
          {state.family.map((m) => (
            <Link key={m.id} href={`/family/${m.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-ivory/60">
              <MemberAvatar member={m} size={38} />
              <span className="flex-1">
                <span className="block text-[15.5px] font-bold text-ink-strong">{m.name}</span>
                <span className="block text-[13px] text-ink-muted">{m.relationship}{m.age ? ` · ${m.age}` : ""}</span>
              </span>
              <ChevronRight className="size-4 text-ink-muted" aria-hidden />
            </Link>
          ))}
          <Link href="/family" className="block px-5 py-3.5 text-[14.5px] font-bold text-peach-deep hover:bg-ivory/60">
            Manage family
          </Link>
        </Group>

        <Group label="Language & sound">
          <div className="space-y-2 px-5 py-4">
            <p className="text-[15.5px] font-bold text-ink-strong">App language</p>
            <PillGroup label="App language" value={s.language} onChange={(v) => set({ language: v })} options={[{ value: "en", label: "English" }, { value: "hi", label: "हिन्दी" }]} />
            <p className="text-[12.5px] text-ink-muted">Navigation and greetings switch language. Reminders to family stay in Hinglish, the way they&apos;re spoken.</p>
          </div>
          <div className="space-y-2 px-5 py-4">
            <p className="text-[15.5px] font-bold text-ink-strong">Reminder sound</p>
            <PillGroup label="Reminder sound" value={s.reminderSound} onChange={(v) => set({ reminderSound: v })} options={[{ value: "Gentle", label: "Gentle" }, { value: "Bell", label: "Bell" }, { value: "Silent", label: "Silent" }]} />
          </div>
        </Group>

        <Group label="Voice">
          <Row
            htmlFor="s-wispr"
            title="Wispr Flow"
            body={s.wisprEnabled ? "Speak into any SMARAN text box using Wispr Flow dictation." : "Wispr Flow prompts are hidden. You can still type."}
            control={
              <span className="flex items-center gap-3">
                <WisprFlowMark size={28} />
                <Switch id="s-wispr" checked={s.wisprEnabled} onCheckedChange={(v) => set({ wisprEnabled: v })} />
              </span>
            }
          />
        </Group>

        <Group label="Notifications">
          <Row htmlFor="s-notif" title="Reminder notifications" body="Show a banner when a family reminder is sent." control={<Switch id="s-notif" checked={s.notifications} onCheckedChange={(v) => set({ notifications: v })} />} />
          <Row htmlFor="s-fam" title="Family updates" body="Tell me when someone confirms or needs help." control={<Switch id="s-fam" checked={s.familyUpdates} onCheckedChange={(v) => set({ familyUpdates: v })} />} />
        </Group>

        <Group label="Data & privacy">
          <div className="flex items-start gap-3 px-5 py-4">
            <Lock className="mt-0.5 size-5 shrink-0 text-brown" aria-hidden />
            <p className="text-[13.5px] leading-relaxed text-ink">
              Everything stays in this browser: family details and memory in local storage, document files in IndexedDB. SMARAN has no server and no account in this prototype. Please use fictional details only.
            </p>
          </div>
          <Row title="Export family memory" body="Download everything as a JSON file." control={<Button variant="outline" size="sm" onClick={exportData}><Download className="size-4" aria-hidden /> Export</Button>} />
          <Row title="Clear all data" body="Start from an empty SMARAN with only Mummy and Papa." control={<Button variant="outline" size="sm" onClick={() => setClearing(true)}><Eraser className="size-4" aria-hidden /> Clear</Button>} />
        </Group>

        <Group label="Demo">
          <Row
            htmlFor="s-clock"
            title="Demo clock"
            body="Everything “today” follows this time."
            control={<Input id="s-clock" type="time" className="w-[128px]" value={timeOf(state.demoNow)} onChange={(e) => e.target.value && update((st) => setDemoTime(st, e.target.value))} />}
          />
          <Row title="Reset demo" body="Restore the sample family, reminders and documents." control={<Button size="sm" onClick={() => setResetting(true)}><RotateCcw className="size-4" aria-hidden /> Reset</Button>} />
          <Link href="/welcome" className="block px-5 py-3.5 text-[14.5px] font-bold text-peach-deep hover:bg-ivory/60">
            Replay onboarding
          </Link>
        </Group>

        <p className="text-center text-[12px] text-ink-muted">SMARAN · स्मरण — prototype. Not a medical device and not a medical record.</p>
      </div>

      <ResetDemoDialog
        open={resetting}
        onOpenChange={setResetting}
        onConfirm={() => {
          resetDemo();
          setName("Rahul");
          toast.success("Demo reset");
        }}
      />
      <Modal
        open={clearing}
        onOpenChange={setClearing}
        title="Clear all data?"
        description="Reminders, appointments, documents and memory will be removed from this browser. Mummy and Papa stay so you can start again."
        footer={
          <>
            <Button variant="outline" onClick={() => setClearing(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearAll();
                setClearing(false);
                toast("All data cleared");
              }}
            >
              Clear everything
            </Button>
          </>
        }
      />
    </Screen>
  );
}
