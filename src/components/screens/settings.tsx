"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight, Download, Eraser, Lock, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { readDeviceState, useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { updateSettings } from "@/lib/store/actions";
import { authAction, migrateDeviceRecords } from "@/lib/store/cloud";
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
  const { state, session, update, resetDemo, clearAll, refreshSession, refreshVault } = useStore();
  const { isWeb } = useView();
  const [name, setName] = useState(state.user.name);
  const [resetting, setResetting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [migrating, setMigrating] = useState(false);
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

        <Group label="Family account">
          <div className="space-y-3 px-5 py-4">
            <p className="text-[13.5px] leading-relaxed text-ink">{session.message}</p>
            {session.authenticated ? (
              <>
                <p className="text-[13px] text-ink-muted">Signed in. Care recipients such as Mummy or Papa are family profiles, not login accounts.</p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={authBusy}
                  onClick={async () => {
                    setAuthBusy(true);
                    try {
                      await authAction({ action: "logout" });
                      await refreshSession();
                      toast.success("Signed out. Browser records were not deleted.");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Sign-out failed.");
                    } finally {
                      setAuthBusy(false);
                    }
                  }}
                >
                  Sign out
                </Button>
                <Button
                  size="sm"
                  disabled={migrating}
                  onClick={async () => {
                    setMigrating(true);
                    try {
                      const device = readDeviceState();
                      await migrateDeviceRecords({
                        consent: "copy-device-records-to-my-family",
                        recipients: device.family.map((m) => ({ name: m.name, relationship: m.relationship })),
                        appointments: device.appointments.filter((a) => a.source !== "sample").map((a) => ({
                          recipientName: device.family.find((m) => m.id === a.familyMemberId)?.name ?? "Family",
                          doctor: a.doctor,
                          date: a.date,
                          time: a.time,
                        })),
                        reminders: device.reminders.filter((r) => r.source !== "sample").map((r) => ({
                          recipientName: device.family.find((m) => m.id === r.familyMemberId)?.name ?? "Family",
                          title: r.title,
                          kind: r.kind,
                          time: r.time,
                          recurrence: r.frequency,
                        })),
                      });
                      await refreshVault();
                      toast.success("Copied into your family vault. Browser copies were not deleted.");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Migration failed.");
                    } finally {
                      setMigrating(false);
                    }
                  }}
                >
                  Copy this browser&apos;s records into my family
                </Button>
              </>
            ) : session.configured ? (
              <form
                className="space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setAuthBusy(true);
                  try {
                    await authAction({ action: "login", email, password });
                    await refreshSession();
                    toast.success("Signed in. Showing your family vault.");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Sign-in failed.");
                  } finally {
                    setAuthBusy(false);
                  }
                }}
              >
                <Label htmlFor="s-email">Email</Label>
                <Input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                <Label htmlFor="s-pass">Password</Label>
                <Input id="s-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="current-password" />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="submit" size="sm" disabled={authBusy}>Sign in</Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={authBusy}
                    onClick={async () => {
                      setAuthBusy(true);
                      try {
                        const out = await authAction({ action: "signup", email, password, displayName: name });
                        toast.success(out.needsEmailConfirmation ? "Check your email to confirm the account." : "Account created.");
                        await refreshSession();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Sign-up failed.");
                      } finally {
                        setAuthBusy(false);
                      }
                    }}
                  >
                    Create account
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-[13px] text-ink-muted">Device-local mode. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable a real family vault. Browser data is not cloud-synced.</p>
            )}
          </div>
        </Group>

        <Group label="Data & privacy">
          <div className="flex items-start gap-3 px-5 py-4">
            <Lock className="mt-0.5 size-5 shrink-0 text-brown" aria-hidden />
            <p className="text-[13.5px] leading-relaxed text-ink">
              {session.authenticated
                ? "Signed-in family records load from Supabase under row-level security. This browser still keeps a separate local copy. We never upload that copy unless you use Copy into my family."
                : "Family details and memory on this device live in local storage; document files live in IndexedDB. That is not a shared cloud vault."}
            </p>
          </div>
          <Row title="Export family memory" body="Download everything as a JSON file." control={<Button variant="outline" size="sm" onClick={exportData}><Download className="size-4" aria-hidden /> Export</Button>} />
          <Row title="Clear all data" body="Start from an empty SMARAN with only Mummy and Papa." control={<Button variant="outline" size="sm" onClick={() => setClearing(true)}><Eraser className="size-4" aria-hidden /> Clear</Button>} />
        </Group>

        <Group label="Sample data">
          <Row title="Reset sample family" body="Restore Mummy and Papa, reminders, appointments and documents." control={<Button size="sm" onClick={() => setResetting(true)}><RotateCcw className="size-4" aria-hidden /> Reset</Button>} />
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
          toast.success("Sample family restored");
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
