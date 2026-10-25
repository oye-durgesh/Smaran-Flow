import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppState, Appointment, FamilyMember, HealthDocument, HealthMeasurement, Medicine, MedicineRefill, MemoryEvent, Reminder } from "@/lib/types";
import { readSession, type DeviceSession } from "./session";
import { createUserClient } from "./supabase";
import { matchStoredAppointments, requireUniqueAppointment } from "./access";
import { findPerson } from "@/lib/nlu/common";
import { VaultError } from "./vault-error";

export { VaultError };

export async function requireAuthedFamily(): Promise<{ session: DeviceSession; supabase: SupabaseClient; familyId: string; userId: string }> {
  const session = await readSession();
  if (session.mode === "device-local") throw new VaultError("This server is in device-local mode. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.", 503);
  if (!session.authenticated || !session.userId) throw new VaultError("Sign in to use the family vault.", 401);
  const supabase = await createUserClient();
  let familyId = session.familyId;
  if (!familyId) {
    const { data, error } = await supabase.rpc("ensure_own_family");
    if (error || !data) throw new VaultError(error?.message || "Could not create a family.", 500);
    familyId = data as string;
  }
  return { session: { ...session, familyId }, supabase, familyId, userId: session.userId };
}

function mapRecipient(row: { id: string; display_name: string; relationship: string | null; created_at: string }): FamilyMember {
  return {
    id: row.id,
    name: row.display_name,
    relationship: (row.relationship as FamilyMember["relationship"]) || "Other",
    avatar: { initials: row.display_name.charAt(0).toUpperCase(), tone: "peach" },
    createdAt: row.created_at.slice(0, 16),
  };
}

function mapAppointment(row: Record<string, unknown>): Appointment {
  return {
    id: String(row.id),
    familyMemberId: String(row.recipient_id),
    doctor: String(row.doctor),
    date: String(row.local_date),
    time: String(row.local_time).slice(0, 5),
    location: row.location ? String(row.location) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    documentIds: [],
    reminders: [],
    status: row.status === "completed" || row.status === "cancelled" ? row.status : "upcoming",
    createdAt: String(row.created_at).slice(0, 16),
    source: row.is_sample ? "sample" : "manual",
  };
}

function mapReminder(row: Record<string, unknown>): Reminder {
  return {
    id: String(row.id),
    familyMemberId: String(row.recipient_id),
    title: String(row.title),
    kind: row.kind === "medicine" || row.kind === "check" || row.kind === "pickup" ? row.kind : "other",
    time: String(row.local_time || "09:00").slice(0, 5),
    frequency: row.recurrence === "weekly" || row.recurrence === "once" ? row.recurrence : "daily",
    date: row.local_date ? String(row.local_date) : undefined,
    status: row.status === "paused" ? "paused" : "active",
    createdAt: String(row.created_at).slice(0, 16),
    source: row.is_sample ? "sample" : "manual",
    confirmationHistory: [],
    medicineId: row.medicine_id ? String(row.medicine_id) : undefined,
    reminderRole: row.reminder_role === "refill" ? "refill" : row.medicine_id ? "dose" : undefined,
  };
}

function mapMedicine(row: Record<string, unknown>): Medicine {
  const times = Array.isArray(row.times) ? row.times.map((t) => String(t).slice(0, 5)) : [];
  return {
    id: String(row.id),
    familyMemberId: String(row.recipient_id),
    name: String(row.name),
    strength: row.strength ? String(row.strength) : undefined,
    dosage: row.dosage ? String(row.dosage) : undefined,
    route: row.route ? String(row.route) : undefined,
    frequency: row.frequency === "twice_daily" || row.frequency === "weekly" || row.frequency === "as_needed" || row.frequency === "custom" ? row.frequency : "daily",
    times,
    startDate: String(row.start_date),
    endDate: row.end_date ? String(row.end_date) : undefined,
    ongoing: Boolean(row.ongoing),
    status: row.status === "paused" || row.status === "completed" || row.status === "stopped" || row.status === "archived" ? row.status : "active",
    prescriber: row.prescriber ? String(row.prescriber) : undefined,
    instructions: row.instructions ? String(row.instructions) : undefined,
    source: row.source === "prescription" || row.source === "document" || row.source === "other" ? row.source : "manual",
    documentId: row.document_id ? String(row.document_id) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    reminderSetup: row.reminder_setup === "paused" || row.reminder_setup === "needs_setup" ? row.reminder_setup : "scheduled",
    createdAt: String(row.created_at).slice(0, 16),
    updatedAt: String(row.updated_at || row.created_at).slice(0, 16),
    recordedBy: row.created_by ? String(row.created_by) : undefined,
    changeHistory: [],
  };
}

function mapRefill(row: Record<string, unknown>): MedicineRefill {
  return {
    id: String(row.id),
    medicineId: String(row.medicine_id),
    familyMemberId: String(row.recipient_id),
    remainingQuantity: row.remaining_quantity == null ? undefined : Number(row.remaining_quantity),
    unit: row.unit ? String(row.unit) : undefined,
    unitsPerDose: row.units_per_dose == null ? undefined : Number(row.units_per_dose),
    plannedDate: row.planned_date ? String(row.planned_date) : undefined,
    reminderDate: row.reminder_date ? String(row.reminder_date) : undefined,
    reminderTime: row.reminder_time ? String(row.reminder_time).slice(0, 5) : undefined,
    status: row.status === "due" || row.status === "completed" || row.status === "snoozed" || row.status === "cancelled" ? row.status : "upcoming",
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at).slice(0, 16),
    updatedAt: String(row.updated_at || row.created_at).slice(0, 16),
  };
}

function missingTable(error: { message?: string } | null): boolean {
  return Boolean(error?.message && /does not exist|schema cache|Could not find the table/i.test(error.message));
}

function mapMeasurement(row: Record<string, unknown>): HealthMeasurement {
  return {
    id: String(row.id),
    familyMemberId: String(row.recipient_id),
    kind: row.kind === "blood_pressure" || row.kind === "blood_sugar" || row.kind === "weight" || row.kind === "heart_rate" ? row.kind : "blood_pressure",
    value: String(row.value),
    unit: String(row.unit || ""),
    recordedAt: String(row.recorded_at).slice(0, 16),
    source: row.is_sample ? "sample" : row.source_type === "document" ? "document" : "manual",
  };
}

export async function loadVault(supabase: SupabaseClient, familyId: string): Promise<Pick<AppState, "family" | "appointments" | "reminders" | "measurements" | "documents" | "memory" | "medicines" | "refills">> {
  const [recipients, appointments, reminders, measurements, documents, memory, medicines, refills] = await Promise.all([
    supabase.from("care_recipients").select("*").eq("family_id", familyId),
    supabase.from("appointments").select("*").eq("family_id", familyId),
    supabase.from("reminders").select("*").eq("family_id", familyId),
    supabase.from("health_measurements").select("*").eq("family_id", familyId).order("recorded_at", { ascending: false }),
    supabase.from("documents").select("*").eq("family_id", familyId),
    supabase.from("memory_events").select("*").eq("family_id", familyId).order("created_at", { ascending: false }),
    supabase.from("medicines").select("*").eq("family_id", familyId),
    supabase.from("medicine_refills").select("*").eq("family_id", familyId),
  ]);
  const err = recipients.error || appointments.error || reminders.error || measurements.error || documents.error || memory.error;
  if (err) throw new VaultError(err.message, 500);
  if (medicines.error && !missingTable(medicines.error)) throw new VaultError(medicines.error.message, 500);
  if (refills.error && !missingTable(refills.error)) throw new VaultError(refills.error.message, 500);

  return {
    family: (recipients.data ?? []).map(mapRecipient),
    appointments: (appointments.data ?? []).map((r) => mapAppointment(r as Record<string, unknown>)),
    reminders: (reminders.data ?? []).map((r) => mapReminder(r as Record<string, unknown>)),
    measurements: (measurements.data ?? []).map((r) => mapMeasurement(r as Record<string, unknown>)),
    documents: (documents.data ?? []).map(
      (r): HealthDocument => ({
        id: String(r.id),
        familyMemberId: String(r.recipient_id || ""),
        name: String(r.name || "Document"),
        type: "other",
        date: String(r.created_at).slice(0, 10),
        file: { name: String(r.name || "file"), size: Number(r.byte_size || 0), mime: String(r.mime || "application/octet-stream"), storage: "local" },
        metadata: { source: r.is_sample ? "sample" : "upload", detectedFrom: "manual" },
        addedAt: String(r.created_at).slice(0, 16),
      }),
    ),
    memory: (memory.data ?? []).map(
      (r): MemoryEvent => ({
        id: String(r.id),
        familyMemberId: String(r.recipient_id || ""),
        type: "appointment_updated",
        title: String(r.title),
        description: r.description ? String(r.description) : undefined,
        timestamp: String(r.created_at).slice(0, 16),
        source: r.is_sample ? "sample" : "manual",
        refId: r.ref_id ? String(r.ref_id) : undefined,
      }),
    ),
    medicines: missingTable(medicines.error) ? [] : (medicines.data ?? []).map((r) => mapMedicine(r as Record<string, unknown>)),
    refills: missingTable(refills.error) ? [] : (refills.data ?? []).map((r) => mapRefill(r as Record<string, unknown>)),
  };
}

export async function setAppointmentStatusDb(supabase: SupabaseClient, familyId: string, userId: string, appointmentId: string, status: Appointment["status"]) {
  const { data: current, error: readErr } = await supabase.from("appointments").select("*").eq("id", appointmentId).eq("family_id", familyId).maybeSingle();
  if (readErr) throw new VaultError(readErr.message, 500);
  if (!current) throw new VaultError("Appointment not found for this family.", 404);
  const previous = current.status;
  const { data: updated, error } = await supabase.from("appointments").update({ status }).eq("id", appointmentId).eq("family_id", familyId).select("*").single();
  if (error || !updated) throw new VaultError(error?.message || "Update failed.", 500);
  const { error: histErr } = await supabase.from("appointment_status_history").insert({
    appointment_id: appointmentId,
    family_id: familyId,
    status,
    previous_status: previous,
    actor_id: userId,
  });
  if (histErr) throw new VaultError(histErr.message, 500);
  await supabase.from("memory_events").insert({
    family_id: familyId,
    recipient_id: current.recipient_id,
    type: status === "completed" ? "appointment_completed" : "appointment_updated",
    title: `${current.doctor} ${status}`,
    actor_id: userId,
    ref_id: appointmentId,
  });
  return mapAppointment(updated as Record<string, unknown>);
}

export async function rescheduleAppointmentDb(supabase: SupabaseClient, familyId: string, userId: string, appointmentId: string, date: string, time: string) {
  const { data: current, error: readErr } = await supabase.from("appointments").select("*").eq("id", appointmentId).eq("family_id", familyId).maybeSingle();
  if (readErr) throw new VaultError(readErr.message, 500);
  if (!current) throw new VaultError("Appointment not found for this family.", 404);
  const { data: updated, error } = await supabase
    .from("appointments")
    .update({ local_date: date, local_time: time, starts_at: `${date}T${time}:00+05:30` })
    .eq("id", appointmentId)
    .eq("family_id", familyId)
    .select("*")
    .single();
  if (error || !updated) throw new VaultError(error?.message || "Reschedule failed.", 500);
  await supabase.from("appointment_status_history").insert({
    appointment_id: appointmentId,
    family_id: familyId,
    status: current.status,
    previous_status: current.status,
    note: `rescheduled from ${current.local_date} ${current.local_time}`,
    actor_id: userId,
  });
  return mapAppointment(updated as Record<string, unknown>);
}

export function resolveAppointmentAction(
  appointments: Appointment[],
  family: FamilyMember[],
  text: string,
  date?: string,
  doctorHint?: string,
) {
  const person = findPerson(text, family);
  const doctor = doctorHint || text.match(/\b(?:dr|doctor)\.?\s+([A-Za-z][A-Za-z-]+)/i)?.[1];
  const matches = matchStoredAppointments(appointments, {
    memberId: person?.id,
    doctor,
    date,
    status: "upcoming",
  });
  return requireUniqueAppointment(matches);
}
