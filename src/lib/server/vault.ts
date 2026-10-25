import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppState, Appointment, DiaryEntry, FamilyDoctor, FamilyMember, HealthDocument, HealthMeasurement, MedicalHistoryEntry, Medicine, MedicineRefill, MemoryEvent, Reminder, Vaccination } from "@/lib/types";
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

function mapRecipient(row: { id: string; display_name: string; relationship: string | null; created_at: string; age?: number | null; color_key?: string | null }): FamilyMember {
  return {
    id: row.id,
    name: row.display_name,
    relationship: (row.relationship as FamilyMember["relationship"]) || "Other",
    age: row.age ?? undefined,
    colorKey: row.color_key ?? undefined,
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
    doctorId: row.doctor_id ? String(row.doctor_id) : undefined,
    doctorCategory: row.doctor_category === "primary" || row.doctor_category === "specialist" ? row.doctor_category : undefined,
    specialty: row.specialty ? String(row.specialty) : undefined,
    clinic: row.clinic ? String(row.clinic) : undefined,
    purpose: row.purpose ? String(row.purpose) : undefined,
    createdBy: row.created_by ? String(row.created_by) : undefined,
    followUpOfId: row.follow_up_of_id ? String(row.follow_up_of_id) : undefined,
    followUpDate: row.follow_up_date ? String(row.follow_up_date) : undefined,
    followUpPurpose: row.follow_up_purpose ? String(row.follow_up_purpose) : undefined,
  };
}

function mapDoctor(row: Record<string, unknown>): FamilyDoctor {
  return {
    id: String(row.id),
    name: String(row.name),
    specialty: row.specialty ? String(row.specialty) : undefined,
    category: row.category === "primary" ? "primary" : "specialist",
    clinic: row.clinic ? String(row.clinic) : undefined,
    address: row.address ? String(row.address) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    documentIds: [],
    recipientIds: Array.isArray(row.recipient_ids) ? row.recipient_ids.map(String) : [],
    archived: Boolean(row.archived),
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
    kind: row.kind === "blood_pressure" || row.kind === "blood_sugar" || row.kind === "weight" || row.kind === "heart_rate" || row.kind === "temperature" || row.kind === "spo2" || row.kind === "other" ? row.kind : "other",
    value: String(row.value),
    unit: String(row.unit || ""),
    systolic: row.systolic == null ? undefined : Number(row.systolic),
    diastolic: row.diastolic == null ? undefined : Number(row.diastolic),
    glucoseContext: row.glucose_context === "fasting" || row.glucose_context === "post_meal" || row.glucose_context === "random" ? row.glucose_context : undefined,
    recordedAt: String(row.recorded_at).slice(0, 16),
    source: row.is_sample ? "sample" : row.source_type === "document" ? "document" : "manual",
    recordedBy: row.author_id ? String(row.author_id) : undefined,
    confirmation: row.confirmation_status === "confirmed" || row.confirmation_status === "needs_review" ? row.confirmation_status : "family_reported",
    note: row.note ? String(row.note) : undefined,
  };
}

export async function loadVault(supabase: SupabaseClient, familyId: string): Promise<Pick<AppState, "family" | "appointments" | "reminders" | "measurements" | "documents" | "memory" | "medicines" | "refills" | "doctors" | "medicalHistory" | "vaccinations" | "diary">> {
  const [recipients, appointments, reminders, measurements, documents, memory, medicines, refills, doctors, history, vaccinations, diary] = await Promise.all([
    supabase.from("care_recipients").select("*").eq("family_id", familyId),
    supabase.from("appointments").select("*").eq("family_id", familyId),
    supabase.from("reminders").select("*").eq("family_id", familyId),
    supabase.from("health_measurements").select("*").eq("family_id", familyId).order("recorded_at", { ascending: false }),
    supabase.from("documents").select("*").eq("family_id", familyId),
    supabase.from("memory_events").select("*").eq("family_id", familyId).order("created_at", { ascending: false }),
    supabase.from("medicines").select("*").eq("family_id", familyId),
    supabase.from("medicine_refills").select("*").eq("family_id", familyId),
    supabase.from("family_doctors").select("*").eq("family_id", familyId),
    supabase.from("medical_history").select("*").eq("family_id", familyId),
    supabase.from("vaccinations").select("*").eq("family_id", familyId),
    supabase.from("health_diary").select("*").eq("family_id", familyId),
  ]);
  const err = recipients.error || appointments.error || reminders.error || measurements.error || documents.error || memory.error;
  if (err) throw new VaultError(err.message, 500);
  if (medicines.error && !missingTable(medicines.error)) throw new VaultError(medicines.error.message, 500);
  if (refills.error && !missingTable(refills.error)) throw new VaultError(refills.error.message, 500);
  if (doctors.error && !missingTable(doctors.error)) throw new VaultError(doctors.error.message, 500);
  if (history.error && !missingTable(history.error)) throw new VaultError(history.error.message, 500);
  if (vaccinations.error && !missingTable(vaccinations.error)) throw new VaultError(vaccinations.error.message, 500);
  if (diary.error && !missingTable(diary.error)) throw new VaultError(diary.error.message, 500);

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
        type: String(r.category || "").includes("prescription") ? "prescription" : String(r.category || "").includes("imaging") ? "scan" : "report",
        date: String(r.report_date || r.created_at).slice(0, 10),
        file: { name: String(r.name || "file"), size: Number(r.byte_size || 0), mime: String(r.mime || "application/octet-stream"), storage: r.is_sample || r.storage_path === "demo-preview" ? "sample" : "local" },
        metadata: {
          source: r.is_sample ? "sample" : "upload",
          detectedFrom: r.is_sample ? "sample" : r.extracted_text ? "description" : "manual",
          description: r.preview_text ? String(r.preview_text) : r.extracted_text ? String(r.extracted_text) : undefined,
          extractStatus: r.is_sample ? "not_extracted" : r.extract_status === "confirmed" || r.extract_status === "needs_review" || r.extract_status === "failed" || r.extract_status === "processing" || r.extract_status === "queued" ? r.extract_status : r.extracted_text ? "needs_review" : "not_extracted",
          extractProvider: r.is_sample ? "demo" : "none",
        },
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
    doctors: missingTable(doctors.error) ? [] : (doctors.data ?? []).map((r) => mapDoctor(r as Record<string, unknown>)),
    medicalHistory: missingTable(history.error)
      ? []
      : (history.data ?? []).map(
          (r): MedicalHistoryEntry => ({
            id: String(r.id),
            familyMemberId: String(r.recipient_id),
            category: r.category === "chronic" || r.category === "surgery" || r.category === "hospitalization" || r.category === "family_history" ? r.category : "illness",
            name: String(r.name),
            status: r.status ? String(r.status) : undefined,
            startDate: r.start_date ? String(r.start_date) : undefined,
            endDate: r.end_date ? String(r.end_date) : undefined,
            hospital: r.hospital ? String(r.hospital) : undefined,
            relationship: r.relationship ? String(r.relationship) : undefined,
            notes: r.notes ? String(r.notes) : undefined,
            source: r.is_sample ? "sample" : "manual",
            recordedBy: r.created_by ? String(r.created_by) : undefined,
            createdAt: String(r.created_at).slice(0, 16),
            updatedAt: String(r.updated_at || r.created_at).slice(0, 16),
          }),
        ),
    vaccinations: missingTable(vaccinations.error)
      ? []
      : (vaccinations.data ?? []).map(
          (r): Vaccination => ({
            id: String(r.id),
            familyMemberId: String(r.recipient_id),
            name: String(r.name),
            dose: r.dose ? String(r.dose) : undefined,
            receivedDate: r.received_date ? String(r.received_date) : undefined,
            nextDueDate: r.next_due_date ? String(r.next_due_date) : undefined,
            clinic: r.clinic ? String(r.clinic) : undefined,
            notes: r.notes ? String(r.notes) : undefined,
            source: r.is_sample ? "sample" : "manual",
            recordedBy: r.created_by ? String(r.created_by) : undefined,
            createdAt: String(r.created_at).slice(0, 16),
          }),
        ),
    diary: missingTable(diary.error)
      ? []
      : (diary.data ?? []).map(
          (r): DiaryEntry => ({
            id: String(r.id),
            familyMemberId: String(r.recipient_id),
            title: String(r.title),
            body: String(r.body),
            recordedAt: String(r.recorded_at || r.created_at).slice(0, 16),
            recordedBy: r.created_by ? String(r.created_by) : undefined,
            source: r.is_sample ? "sample" : "manual",
          }),
        ),
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

const WIPE_TABLES = [
  "in_app_notifications",
  "reminder_delivery_attempts",
  "reminder_occurrences",
  "health_diary",
  "memory_events",
  "vaccinations",
  "medical_history",
  "medicine_refills",
  "medicine_changes",
  "reminders",
  "medicines",
  "appointment_status_history",
  "appointments",
  "health_measurements",
  "documents",
  "family_doctors",
  "care_notes",
  "care_recipients",
] as const;

export async function wipeOwnedFamilyRecords(supabase: SupabaseClient, userId: string): Promise<{ families: number; errors: string[] }> {
  const { data: memberships, error } = await supabase.from("family_memberships").select("family_id, role").eq("user_id", userId);
  if (error) throw new VaultError(error.message, 500);
  const errors: string[] = [];
  const ids = [...new Set((memberships ?? []).filter((m) => m.role === "owner" || m.role === "caregiver").map((m) => String(m.family_id)))];
  for (const familyId of ids) {
    for (const table of WIPE_TABLES) {
      const { error: delErr } = await supabase.from(table).delete().eq("family_id", familyId);
      if (delErr && !/does not exist|schema cache/i.test(delErr.message)) errors.push(`${table}: ${delErr.message}`);
    }
  }
  return { families: ids.length, errors };
}
