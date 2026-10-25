export type PersistenceMode = "supabase" | "device-local";

export interface SessionPayload {
  mode: PersistenceMode;
  userId: string | null;
  familyId: string | null;
  role: string | null;
  authenticated: boolean;
  configured: boolean;
  persistence: PersistenceMode;
  cloud: boolean;
  message: string;
}

export function isUuid(id: string | undefined): boolean {
  return Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
}

export async function fetchSession(): Promise<SessionPayload> {
  const res = await fetch("/api/session", { cache: "no-store" });
  const data = (await res.json()) as SessionPayload;
  return data;
}

export async function fetchVault(): Promise<
  | { ok: true; family: unknown[]; appointments: unknown[]; reminders: unknown[]; measurements: unknown[]; documents: unknown[]; memory: unknown[] }
  | { ok: false; status: number; error: string; persistence?: string }
> {
  const res = await fetch("/api/vault", { cache: "no-store" });
  const data = (await res.json()) as { error?: string; persistence?: string; family?: unknown[] };
  if (!res.ok) return { ok: false, status: res.status, error: data.error || "Vault load failed.", persistence: data.persistence };
  return { ok: true, ...(data as { family: unknown[]; appointments: unknown[]; reminders: unknown[]; measurements: unknown[]; documents: unknown[]; memory: unknown[] }) };
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

export async function createCloudAppointment(input: { recipientId: string; doctor: string; date: string; time: string; location?: string; notes?: string }) {
  const res = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = (await res.json()) as { error?: string; id?: string };
  if (!res.ok) throw new Error(data.error || "Appointment create failed.");
  return data;
}

export async function createCloudReminder(input: { recipientId: string; title: string; kind: string; time: string; date?: string; recurrence: string; medicineName?: string }) {
  const res = await fetch("/api/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = (await res.json()) as { error?: string; id?: string };
  if (!res.ok) throw new Error(data.error || "Reminder create failed.");
  return data;
}

export async function createCloudMeasurement(input: { recipientId: string; kind: string; value: string; unit: string; sourceType?: string }) {
  const res = await fetch("/api/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = (await res.json()) as { error?: string; id?: string };
  if (!res.ok) throw new Error(data.error || "Measurement create failed.");
  return data;
}

export async function migrateDeviceRecords(payload: unknown) {
  const res = await fetch("/api/migrate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = (await res.json()) as { error?: string; ok?: boolean; note?: string };
  if (!res.ok) throw new Error(data.error || "Migration failed.");
  return data;
}
