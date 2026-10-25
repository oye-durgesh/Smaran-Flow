"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bell, ChevronRight, Download, Eraser, IdCard, Languages, Lock, RotateCcw, Shield, UserRound, Users, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { readDeviceState, useStore } from "@/lib/store/store";
import { addMember, updateMember, updateSettings } from "@/lib/store/actions";
import { authAction, demoWorkspaceAction, fetchSchedulerStatus, migrateDeviceRecords, wipeCloudVault } from "@/lib/store/cloud";
import { DEMO_LOAD_CONFIRM, DEMO_RESET_CONFIRM } from "@/lib/demo/workspace";
import type { FamilyMember, Relationship, ReminderLanguage, Settings } from "@/lib/types";
import { FAMILY_TIMEZONE } from "@/lib/timezone";
import { allColorChoices, familySwatch } from "@/lib/family-color";
import {
  SETTINGS_GROUPS,
  SETTINGS_LAYOUT,
  SETTINGS_SUBTITLE,
  WISPR_SETTINGS_HELP,
  applySettings,
  familyInviteAvailable,
  reminderLanguageLabel,
  sessionStatusLabel,
  settingsRecordCounts,
  speechOutputAvailable,
} from "@/lib/settings-model";
import { SAMPLE_APPOINTMENT_BADGE, SAMPLE_PREVIEW_LABEL } from "@/lib/demo/appointment-fixtures";
import { Screen } from "@/components/shell/screen";
import { ResetDemoDialog } from "@/components/shell/demo-controls";
import { WisprFlowMark } from "@/components/smaran/brand";
import { WisprFlowSection } from "@/components/smaran/wispr-flow-section";
import { detectSettingsPreference } from "@/lib/wispr-flow-context";
import { MemberAvatar, PageHeader, PillGroup } from "@/components/smaran/primitives";
import { Modal } from "@/components/smaran/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const RELATIONSHIPS: Relationship[] = ["Mother", "Father", "Grandmother", "Grandfather", "Partner", "Other"];

export function SettingsScreen() {
  const { state, session, vaultError, update, resetDemo, clearAll, refreshSession, refreshVault } = useStore();
  const [name, setName] = useState(state.user.name);
  const [resetting, setResetting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [loadSample, setLoadSample] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [schedulerNote, setSchedulerNote] = useState("Checking scheduler…");
  const [memberOpen, setMemberOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyMember | undefined>();
  const [samplePreview, setSamplePreview] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [prefError, setPrefError] = useState<string | null>(null);
  const s = state.settings;
  const counts = settingsRecordCounts(state);
  const status = vaultError ? "Configuration issue" : sessionStatusLabel(session);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = s.reducedMotion ? "true" : "false";
    document.documentElement.dataset.density = s.compactDensity ? "compact" : "comfortable";
  }, [s.reducedMotion, s.compactDensity]);

  useEffect(() => {
    void fetchSchedulerStatus()
      .then((status) => setSchedulerNote(status.message))
      .catch(() => setSchedulerNote("Could not read scheduler status. Hosted cron has not been verified."));
  }, []);

  function setPref(patch: Partial<Settings>) {
    setPrefError(null);
    const result = applySettings(state, patch);
    if (!result.ok) {
      setPrefError(result.error);
      toast.error(result.error);
      return;
    }
    update(() => result.state);
  }

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === state.user.name) return setName(state.user.name);
    update((st) => ({ ...st, user: { name: trimmed } }));
    toast.success("Name updated");
  };

  const exportData = () => {
    const payload = { exportedFrom: "SMARAN", note: "Only this device's authorized family copy. Document files stay in this browser.", ...state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smaran-family-${state.user.name || "memory"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Family memory exported from this device");
  };

  return (
    <Screen width="wide" className="!max-w-none">
      <PageHeader
        title="Settings"
        subtitle={SETTINGS_SUBTITLE}
        actions={
          <a href="#family-account" className="text-[13px] font-bold text-peach-deep hover:underline">
            Account & privacy
          </a>
        }
      />
      <p className="mb-4 inline-flex rounded-full border border-[#F0D9CC] bg-[#FFFCFA] px-3 py-1 text-[12.5px] font-bold text-[#7A5346]" role="status">
        {status}
        {session.role ? ` · ${session.role}` : ""}
      </p>
      <p className="sr-only">{SETTINGS_GROUPS.join(" ")}</p>
      {prefError && <p className="mb-3 text-[13px] font-semibold text-missed" role="alert">{prefError}</p>}

      <div className={cn("grid gap-4", SETTINGS_LAYOUT.mobile, SETTINGS_LAYOUT.desktop)}>
        <div className="space-y-4">
          <Card title="About me" icon={<UserRound className="size-4" />}>
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-full bg-[#FBE4D7] text-[18px] font-extrabold text-[#8F4538]">{state.user.name.charAt(0)}</span>
              <div className="min-w-0 flex-1">
                <Label htmlFor="s-name">Name</Label>
                <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} className="mt-1 h-9" />
              </div>
            </div>
            <p className="mt-2 text-[12.5px] text-[#9A8173]">
              {session.authenticated
                ? `Account: ${session.email || "signed in (email not provided by the session)"}`
                : "Signed out — no account email."}
            </p>
            <p className="text-[12.5px] text-[#9A8173]">This name is the signed-in caregiver, not a care recipient.</p>
          </Card>

          <Card title="Family members" icon={<Users className="size-4" />} action={<Button size="sm" className="h-8 rounded-full bg-[#E8A98D] text-[#49352C] hover:bg-[#E8A98D]" onClick={() => { setEditing(undefined); setMemberOpen(true); }}>+ Add family member</Button>}>
            <ul className="space-y-2">
              {state.family.map((m) => {
                const swatch = familySwatch(m);
                return (
                  <li key={m.id} className="flex items-center gap-2.5 rounded-[14px] border border-[#F0D9CC] px-2.5 py-2">
                    <MemberAvatar member={m} size={36} identity />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold text-[#49352C]">{m.name}</span>
                      <span className="block text-[12px] text-[#9A8173]">{m.relationship}{m.age ? ` · ${m.age}` : ""}</span>
                    </span>
                    <span className="size-4 rounded-full" style={{ background: swatch.primary }} title={swatch.label} />
                    <button type="button" className="text-[12px] font-bold text-peach-deep" onClick={() => { setEditing(m); setMemberOpen(true); }}>Edit</button>
                    <Link href={`/health-card/${m.id}`} className="text-[#9A8173]" aria-label={`${m.name} health card`}><IdCard className="size-4" /></Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Voice & language" icon={<Languages className="size-4" />}>
            <p className="mb-1 text-[12.5px] font-bold text-[#9A8173]">App language — navigation labels only</p>
            <PillGroup label="App language" value={s.language} onChange={(v) => setPref({ language: v })} options={[{ value: "en", label: "English" }, { value: "hi", label: "हिन्दी" }]} />
            <p className="mt-3 mb-1 text-[12.5px] font-bold text-[#9A8173]">Reminder phrasing — does not change schedules</p>
            <PillGroup
              label="Reminder language"
              value={s.reminderLanguage}
              onChange={(v) => setPref({ reminderLanguage: v })}
              options={([
                { value: "en", label: reminderLanguageLabel("en") },
                { value: "hi", label: reminderLanguageLabel("hi") },
                { value: "hinglish", label: reminderLanguageLabel("hinglish") },
              ]) as { value: ReminderLanguage; label: string }[]}
            />
            <div className="mt-3 rounded-[12px] bg-[#FBE4D7]/50 p-3">
              <div className="flex items-center gap-2">
                <WisprFlowMark size={22} />
                <p className="text-[13.5px] font-bold text-[#49352C]">Wispr Flow</p>
              </div>
              <p className="mt-1 text-[12.5px] leading-5 text-[#7A5346]">{WISPR_SETTINGS_HELP}</p>
              <SwitchRow id="s-wispr" title="Show Wispr Flow prompts" checked={s.wisprEnabled} onChange={(v) => setPref({ wisprEnabled: v })} />
            </div>
            <p className="mt-2 flex items-center gap-2 text-[12.5px] text-[#9A8173]">
              <Volume2 className="size-3.5" />
              {speechOutputAvailable() ? "Spoken replies are available." : "Spoken assistant playback is not implemented. This control is unavailable."}
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Notifications & reminders" icon={<Bell className="size-4" />}>
            <SwitchRow id="s-notif" title="In-app reminder banners" checked={s.notifications} onChange={(v) => setPref({ notifications: v })} />
            <SwitchRow id="s-fam" title="Family update banners" checked={s.familyUpdates} onChange={(v) => setPref({ familyUpdates: v })} />
            <p className="mt-2 text-[12.5px] leading-5 text-[#7A5346]">
              When banners are off, due reminders still persist in the notification centre. Schedules are not deleted.
            </p>
            <p className="mt-2 text-[12.5px] font-bold text-[#9A8173]">Reminder language</p>
            <PillGroup
              label="Reminder language"
              value={s.reminderLanguage}
              onChange={(v) => setPref({ reminderLanguage: v })}
              options={[
                { value: "en", label: reminderLanguageLabel("en") },
                { value: "hi", label: reminderLanguageLabel("hi") },
                { value: "hinglish", label: reminderLanguageLabel("hinglish") },
              ]}
            />
            <p className="mt-2 text-[12.5px] leading-5 text-[#7A5346]">Reminder sound is not implemented. No audio plays when an alert is due.</p>
            <p className="mt-2 text-[12.5px] leading-5 text-[#7A5346]">{schedulerNote}</p>
            <p className="mt-2 text-[12px] text-[#9A8173]">
              In-app only. SMARAN does not send phone calls, SMS, WhatsApp, email, or browser push. A closed browser cannot show a toast; the due row waits in the notification centre.
            </p>
            <div className="mt-4">
              <WisprFlowSection
                context="settings"
                onCapture={async (text) => {
                  const pref = detectSettingsPreference(text);
                  if (!pref) return "Settings cannot create medical reminders or appointments.";
                  if (pref.field === "reminderLanguage") {
                    setPref({ reminderLanguage: pref.value as ReminderLanguage });
                    toast.success("Reminder language updated.");
                    return;
                  }
                  if (pref.value === "open") return "Use the in-app reminder banners switch above. Nothing else was changed.";
                  if (pref.value === "colors") return "Family colours are in About me on the left. Nothing was changed automatically.";
                }}
              />
            </div>
          </Card>

          <Card id="family-account" title="Family account" icon={<Shield className="size-4" />}>
            <p className="text-[13px] leading-relaxed text-[#49352C]">{session.message}</p>
            {session.authenticated ? (
              <div className="mt-2 space-y-2">
                <p className="text-[12.5px] text-[#9A8173]">Care recipients are not login accounts. Role: {session.role || "member"}.</p>
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
              </div>
            ) : session.configured ? (
              <form
                className="mt-2 space-y-2"
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
                <Input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="h-9" />
                <Label htmlFor="s-pass">Password</Label>
                <Input id="s-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="current-password" className="h-9" />
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
              <p className="mt-2 text-[12.5px] text-[#9A8173]">Supabase keys are not configured. This device stays local.</p>
            )}
            <p className="mt-2 text-[12.5px] text-[#9A8173]">{familyInviteAvailable() ? "Invite is available." : "Family invitations are not implemented."}</p>
          </Card>

          <Card title="Workspace" icon={<Users className="size-4" />}>
            <p className="text-[12.5px] text-[#7A5346]">
              {session.authenticated
                ? session.isDemo
                  ? "Active: SMARAN Demo Family. Records are fictional."
                  : "Active: your real family. Demo fixtures are not mixed in."
                : "Sign in to create a separate Supabase demo family. Local sample preview stays on this device."}
            </p>
            {session.authenticated && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(session.workspaces ?? []).filter((w) => !w.isDemo).map((w) => (
                  <Button key={w.id} size="sm" variant={session.familyId === w.id ? "default" : "outline"} disabled={demoBusy} onClick={async () => {
                    setDemoBusy(true);
                    try {
                      await demoWorkspaceAction({ action: "switch", familyId: w.id });
                      await refreshSession();
                      toast.success("Using your real family.");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not switch workspace.");
                    } finally {
                      setDemoBusy(false);
                    }
                  }}>Use my real family</Button>
                ))}
                {(session.workspaces ?? []).filter((w) => w.isDemo).map((w) => (
                  <Button key={w.id} size="sm" variant={session.familyId === w.id ? "default" : "outline"} disabled={demoBusy} onClick={async () => {
                    setDemoBusy(true);
                    try {
                      await demoWorkspaceAction({ action: "switch", familyId: w.id });
                      await refreshSession();
                      toast.success("Opened SMARAN Demo Family.");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not open demo family.");
                    } finally {
                      setDemoBusy(false);
                    }
                  }}>Open SMARAN Demo Family</Button>
                ))}
                <Button size="sm" variant="outline" disabled={demoBusy} onClick={async () => {
                  if (!window.confirm(DEMO_LOAD_CONFIRM)) return;
                  setDemoBusy(true);
                  try {
                    const result = await demoWorkspaceAction({ action: "load", confirm: true });
                    await refreshSession();
                    toast.success(result.reused ? "Demo family already loaded — no duplicates added." : "Demo family data loaded.");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not load demo family. Apply migration 0008 if columns are missing.");
                  } finally {
                    setDemoBusy(false);
                  }
                }}>Load demo family data</Button>
                <Button size="sm" variant="outline" disabled={demoBusy || !session.workspaces?.some((w) => w.isDemo)} onClick={async () => {
                  if (!window.confirm(DEMO_RESET_CONFIRM)) return;
                  setDemoBusy(true);
                  try {
                    await demoWorkspaceAction({ action: "reset", confirm: true });
                    await refreshSession();
                    toast.success("Demo dataset reset. Real family unchanged.");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Reset failed.");
                  } finally {
                    setDemoBusy(false);
                  }
                }}>Reset demo dataset</Button>
                <Button size="sm" variant="outline" disabled={demoBusy || !session.isDemo} onClick={async () => {
                  setDemoBusy(true);
                  try {
                    const result = await demoWorkspaceAction({ action: "test-reminder", minutesAhead: 2 });
                    toast.success(`Demo test reminder saved for ${result.dueLocal}. Same reminder tables — not a fake toast.`);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Test reminder failed.");
                  } finally {
                    setDemoBusy(false);
                  }
                }}>Schedule 2-minute demo test reminder</Button>
              </div>
            )}
          </Card>

          <Card title="Data & demo" icon={<Lock className="size-4" />}>
            <p className="text-[12.5px] text-[#7A5346]">
              Recipients {counts.recipients} · Documents {counts.documents} · Appointments {counts.appointments} · Measurements {counts.measurements} · Medicines {counts.medicines}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {samplePreview ? (
                <Button size="sm" variant="outline" onClick={() => setSamplePreview(false)}>Leave {SAMPLE_PREVIEW_LABEL}</Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setSamplePreview(true)}>Preview sample data</Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setLoadSample(true)}><RotateCcw className="size-3.5" /> Start with an empty family</Button>
              <Button size="sm" variant="outline" onClick={exportData}><Download className="size-3.5" /> Export</Button>
              <Button size="sm" variant="outline" onClick={() => void refreshVault()}>Refresh vault</Button>
            </div>
            {samplePreview && <p className="mt-2 text-[12px] font-bold text-[#8F4538]">{SAMPLE_APPOINTMENT_BADGE} Isolated from the vault.</p>}
            {session.authenticated && (
              <Button
                size="sm"
                className="mt-2"
                disabled={migrating}
                onClick={async () => {
                  if (!window.confirm("Copy this browser's non-sample records into your signed-in family? Sample fixtures are excluded. Browser copies stay here.")) return;
                  setMigrating(true);
                  try {
                    const device = readDeviceState();
                    await migrateDeviceRecords({
                      consent: "copy-device-records-to-my-family",
                      recipients: device.family.map((m) => ({ name: m.name, relationship: m.relationship })),
                      appointments: device.appointments.filter((a) => a.source !== "sample").map((a) => ({
                        recipientName: device.family.find((x) => x.id === a.familyMemberId)?.name ?? "Family",
                        doctor: a.doctor,
                        date: a.date,
                        time: a.time,
                      })),
                      reminders: device.reminders.filter((r) => r.source !== "sample").map((r) => ({
                        recipientName: device.family.find((x) => x.id === r.familyMemberId)?.name ?? "Family",
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
            )}
            <button type="button" className="mt-3 flex items-center gap-1 text-[13px] font-bold text-missed" onClick={() => setClearing(true)}>
              <Eraser className="size-3.5" /> Delete all SMARAN data and start empty
            </button>
          </Card>

          <Card title="App preferences" icon={<ChevronRight className="size-4" />}>
            <SwitchRow id="s-motion" title="Reduce motion" checked={s.reducedMotion} onChange={(v) => setPref({ reducedMotion: v })} />
            <SwitchRow id="s-dense" title="Compact cards" checked={s.compactDensity} onChange={(v) => setPref({ compactDensity: v })} />
            <p className="mt-2 text-[12.5px] text-[#9A8173]">Timezone for schedules: {FAMILY_TIMEZONE}. Display preferences do not shift appointment times.</p>
            <Link href="/welcome" className="mt-2 inline-block text-[13px] font-bold text-peach-deep">Replay onboarding</Link>
            <p className="mt-3 text-[12px] text-[#9A8173]">SMARAN · स्मरण — not a medical device and not a medical record. Secrets stay server-side.</p>
          </Card>
        </div>
      </div>

      <MemberEditor open={memberOpen} member={editing} onOpenChange={setMemberOpen} />
      <ResetDemoDialog
        open={resetting || loadSample}
        onOpenChange={(o) => { setResetting(o); setLoadSample(o); }}
        onConfirm={() => {
          resetDemo();
          setName("");
          setSamplePreview(false);
          toast.success("This browser is empty. Add family members when you are ready.");
        }}
      />
      <Modal
        open={clearing}
        onOpenChange={setClearing}
        title="Delete all SMARAN data?"
        description="Removes every person and record in this browser. If you are signed in, it also deletes records in your Supabase families (real and demo). Memberships stay so you can add people again. This cannot be undone."
        footer={
          <>
            <Button variant="outline" onClick={() => setClearing(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  if (session.authenticated) await wipeCloudVault();
                  clearAll();
                  setName("");
                  setSamplePreview(false);
                  await refreshVault();
                  toast.success("SMARAN is empty. Add your family when you are ready.");
                } catch (e) {
                  clearAll();
                  setName("");
                  toast.error(e instanceof Error ? `${e.message} Local data was still cleared.` : "Local data cleared. Cloud wipe failed.");
                } finally {
                  setClearing(false);
                }
              }}
            >
              Delete everything
            </Button>
          </>
        }
      />
    </Screen>
  );
}

function Card({ title, icon, action, children, id }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-[18px] border border-[#F0D9CC] bg-[#FFFCFA] p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[14px] font-extrabold text-[#49352C]">{icon}{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SwitchRow({ id, title, checked, onChange }: { id: string; title: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <label htmlFor={id} className="text-[13.5px] font-semibold text-[#49352C]">{title}</label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function MemberEditor({ open, onOpenChange, member }: { open: boolean; onOpenChange: (o: boolean) => void; member?: FamilyMember }) {
  const { session, commit, update, refreshVault } = useStore();
  const [form, setForm] = useState({ name: "", relationship: "Other" as Relationship, age: "", phone: "", colorKey: "" });
  const [error, setError] = useState<string | null>(null);
  const [prev, setPrev] = useState(open);
  if (open !== prev) {
    setPrev(open);
    if (open) {
      setForm(member
        ? { name: member.name, relationship: member.relationship, age: member.age ? String(member.age) : "", phone: member.phone ?? "", colorKey: member.colorKey ?? familySwatch(member).key }
        : { name: "", relationship: "Other", age: "", phone: "", colorKey: "sand" });
      setError(null);
    }
  }
  const preview = { id: member?.id ?? "new", name: form.name || "New", relationship: form.relationship, colorKey: form.colorKey };
  const save = async () => {
    if (!form.name.trim()) return setError("Add a name so SMARAN knows who this is.");
    const age = form.age ? Number(form.age) : undefined;
    if (age !== undefined && (age < 1 || age > 120)) return setError("That age doesn't look right.");
    try {
      if (member) {
        update((s) => updateMember(s, member.id, { name: form.name.trim(), relationship: form.relationship, age, phone: form.phone.trim() || undefined, colorKey: form.colorKey }));
        toast.success("Details saved");
      } else if (session.authenticated) {
        const res = await fetch("/api/family", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name.trim(), relationship: form.relationship }) });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Could not add this person.");
        const ok = await refreshVault();
        if (!ok) throw new Error("Saved on the server, but the vault did not refresh.");
        update((s) => {
          const added = s.family.find((m) => m.name === form.name.trim());
          if (!added) return s;
          return updateSettings(s, { memberColors: { ...s.settings.memberColors, [added.id]: form.colorKey } });
        });
        toast.success(`${form.name.trim()} added to your family vault`);
      } else {
        commit((s) => addMember(s, { name: form.name, relationship: form.relationship, age, phone: form.phone, colorKey: form.colorKey }));
        toast.success(`${form.name.trim()} added to your family`);
      }
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={member ? `Edit ${member.name}` : "Add family member"} footer={
      <>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={() => void save()}>{member ? "Save" : "Add to family"}</Button>
      </>
    }>
      {error && <p className="mb-2 text-[13px] font-semibold text-missed" role="alert">{error}</p>}
      <div className="space-y-3">
        <div><Label htmlFor="m-name">Name</Label><Input id="m-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div>
          <Label htmlFor="m-rel">Relationship</Label>
          <select id="m-rel" className="mt-1 h-10 w-full rounded-[12px] border border-line-strong bg-surface px-3" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value as Relationship })}>
            {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label htmlFor="m-age">Age (optional)</Label><Input id="m-age" inputMode="numeric" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
          <div><Label htmlFor="m-phone">Phone (optional)</Label><Input id="m-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-muted">Identity colour</p>
          <div className="flex flex-wrap gap-2">
            {allColorChoices().map((c) => (
              <button key={c.key} type="button" aria-pressed={form.colorKey === c.key} onClick={() => setForm({ ...form, colorKey: c.key })} className={cn("size-8 rounded-full border-2", form.colorKey === c.key ? "border-[#49352C]" : "border-transparent")} style={{ background: c.primary }} aria-label={c.label} />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-[12px] px-2 py-1.5" style={{ background: familySwatch(preview).background, border: `1px solid ${familySwatch(preview).border}` }}>
            <MemberAvatar member={{ ...preview, avatar: { initials: (form.name || "N").charAt(0).toUpperCase(), tone: "peach" }, createdAt: "2026-01-01T00:00" }} size={28} identity />
            <span className="text-[13px] font-bold" style={{ color: familySwatch(preview).text }}>{form.name || "Preview"}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
