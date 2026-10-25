export type PersistenceMode = "supabase" | "device-local";

export interface SessionWorkspace {
  id: string;
  name: string;
  isDemo: boolean;
  role: string;
  seedVersion: number | null;
  referenceDate: string | null;
}

export interface SessionPayload {
  mode: PersistenceMode;
  userId: string | null;
  familyId: string | null;
  role: string | null;
  email: string | null;
  authenticated: boolean;
  configured: boolean;
  persistence: PersistenceMode;
  cloud: boolean;
  message: string;
  isDemo?: boolean;
  workspaces?: SessionWorkspace[];
  demoSeedVersion?: number | null;
  demoReferenceDate?: string | null;
}

export function isUuid(id: string | undefined): boolean {
  return Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
}

export async function fetchSession(): Promise<SessionPayload> {
  const res = await fetch("/api/session", { cache: "no-store" });
  const data = (await res.json()) as SessionPayload;
  return data;
}

export async function wipeCloudVault() {
  const res = await fetch("/api/vault", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: "delete-all-my-smaran-records" }),
  });
  const data = (await res.json()) as { error?: string; ok?: boolean; families?: number };
  if (!res.ok) throw new Error(data.error || "Vault wipe failed.");
  return data;
}

export async function fetchVault(): Promise<
  | { ok: true; family: unknown[]; appointments: unknown[]; reminders: unknown[]; measurements: unknown[]; documents: unknown[]; memory: unknown[]; medicines?: unknown[]; refills?: unknown[]; doctors?: unknown[]; medicalHistory?: unknown[]; vaccinations?: unknown[]; diary?: unknown[] }
  | { ok: false; status: number; error: string; persistence?: string }
> {
  const res = await fetch("/api/vault", { cache: "no-store" });
  const data = (await res.json()) as { error?: string; persistence?: string; family?: unknown[] };
  if (!res.ok) return { ok: false, status: res.status, error: data.error || "Vault load failed.", persistence: data.persistence };
  return { ok: true, ...(data as { family: unknown[]; appointments: unknown[]; reminders: unknown[]; measurements: unknown[]; documents: unknown[]; memory: unknown[]; medicines?: unknown[]; refills?: unknown[]; doctors?: unknown[]; medicalHistory?: unknown[]; vaccinations?: unknown[]; diary?: unknown[] }) };
}

export async function saveCloudMedicine(input: Record<string, unknown>) {
  const res = await fetch("/api/medicines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = (await res.json()) as { error?: string; id?: string; ok?: boolean };
  if (!res.ok) throw new Error(data.error || "Medicine save failed.");
  return data;
}

export async function patchCloudMedicine(input: Record<string, unknown>) {
  const res = await fetch("/api/medicines", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = (await res.json()) as { error?: string; ok?: boolean };
  if (!res.ok) throw new Error(data.error || "Medicine update failed.");
  return data;
}

export async function authAction(body: { action: "signup" | "login" | "logout"; email?: string; password?: string; displayName?: string }) {
  const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json()) as { error?: string; ok?: boolean; needsEmailConfirmation?: boolean };
  if (!res.ok) throw new Error(data.error || "Authentication failed.");
  return data;
}

export async function patchAppointment(id: string, action: "complete" | "cancel" | "reschedule" | "upcoming", extra?: { date?: string; time?: string }) {
  const res = await fetch("/api/appointments", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action, ...extra }),
  });
  const data = (await res.json()) as { error?: string; appointment?: unknown };
  if (!res.ok) throw new Error(data.error || "Appointment update failed.");
  return data;
}

export async function saveCloudDoctor(input: Record<string, unknown>) {
  const res = await fetch("/api/doctors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = (await res.json()) as { error?: string; id?: string };
  if (!res.ok) throw new Error(data.error || "Doctor save failed.");
  return data;
}

export async function createCloudAppointment(input: { recipientId: string; doctor: string; date: string; time: string; location?: string; notes?: string; doctorId?: string; clinic?: string; purpose?: string; reminderOffsets?: number[]; followUpDate?: string }) {
  const res = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = (await res.json()) as { error?: string; id?: string };
  if (!res.ok) throw new Error(data.error || "Appointment create failed.");
  return data;
}

export async function processDueReminders(): Promise<{ ok: boolean; created: number; error?: string }> {
  const res = await fetch("/api/reminders/process", { method: "POST" });
  const data = (await res.json()) as { created?: number; error?: string };
  if (!res.ok) return { ok: false, created: 0, error: data.error };
  return { ok: true, created: data.created ?? 0, error: data.error };
}

export async function fetchReminderInbox(): Promise<{ ok: boolean; items: unknown[]; error?: string }> {
  const res = await fetch("/api/reminders/inbox", { cache: "no-store" });
  const data = (await res.json()) as { items?: unknown[]; error?: string };
  if (!res.ok) return { ok: false, items: [], error: data.error };
  return { ok: true, items: data.items ?? [] };
}

export async function patchReminderInbox(id: string, action: "read" | "acknowledge" | "snooze" | "skip" | "complete" | "taken") {
  const res = await fetch("/api/reminders/inbox", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
  const data = (await res.json()) as { error?: string; ok?: boolean };
  if (!res.ok) throw new Error(data.error || "Inbox update failed.");
  return data;
}

export async function fetchSchedulerStatus(): Promise<{ configured: boolean; message: string; cronSecretConfigured: boolean; serviceRoleConfigured: boolean; hostingCronVerified: boolean }> {
  const res = await fetch("/api/reminders/status", { cache: "no-store" });
  return (await res.json()) as { configured: boolean; message: string; cronSecretConfigured: boolean; serviceRoleConfigured: boolean; hostingCronVerified: boolean };
}

export async function createCloudReminder(input: { recipientId: string; title: string; kind: string; time: string; date?: string; recurrence: string; medicineName?: string }) {
  const res = await fetch("/api/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = (await res.json()) as { error?: string; id?: string };
  if (!res.ok) throw new Error(data.error || "Reminder create failed.");
  return data;
}

export async function createCloudMeasurement(input: {
  recipientId: string;
  kind: string;
  value: string;
  unit: string;
  sourceType?: string;
  systolic?: number;
  diastolic?: number;
  glucoseContext?: string;
  note?: string;
  recordedAt?: string;
}) {
  const res = await fetch("/api/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = (await res.json()) as { error?: string; id?: string };
  if (!res.ok) throw new Error(data.error || "Measurement create failed.");
  return data;
}

export async function createCloudHealthRecord(input: Record<string, unknown>) {
  const res = await fetch("/api/health-record", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = (await res.json()) as { error?: string; id?: string };
  if (!res.ok) throw new Error(data.error || "Health record save failed.");
  return data;
}

export async function demoWorkspaceAction(body: { action: "load" | "reset" | "switch" | "test-reminder"; familyId?: string; confirm?: boolean; minutesAhead?: number }) {
  const res = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json()) as { error?: string; ok?: boolean; familyId?: string; reused?: boolean; summary?: unknown; dueLocal?: string };
  if (!res.ok) throw new Error(data.error || "Demo workspace update failed.");
  return data;
}

export async function migrateDeviceRecords(payload: unknown) {
  const res = await fetch("/api/migrate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = (await res.json()) as { error?: string; ok?: boolean; note?: string };
  if (!res.ok) throw new Error(data.error || "Migration failed.");
  return data;
}
