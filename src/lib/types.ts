export type ID = string;

/** Calendar date, `YYYY-MM-DD`. */
export type DateKey = string;
/** Wall-clock time, 24h `HH:mm`. */
export type TimeKey = string;
/** Local timestamp without zone, `YYYY-MM-DDTHH:mm`. The demo runs in one family's local time. */
export type LocalTimestamp = string;

export type Relationship =
  | "Mother"
  | "Father"
  | "Grandmother"
  | "Grandfather"
  | "Partner"
  | "Other";

export type AvatarTone = "peach" | "sand" | "terracotta" | "brown";

export interface FamilyMember {
  id: ID;
  name: string;
  relationship: Relationship;
  age?: number;
  phone?: string;
  avatar: { initials: string; tone: AvatarTone };
  createdAt: LocalTimestamp;
}

export type ReminderKind = "medicine" | "check" | "pickup" | "other";
export type ReminderFrequency = "daily" | "weekly" | "once";
export type ReminderLifecycle = "active" | "paused";

/** Derived per-day status shown in the UI. */
export type ReminderDayStatus =
  | "waiting"
  | "upcoming"
  | "confirmed"
  | "missed"
  | "paused";

export interface Confirmation {
  id: ID;
  date: DateKey;
  confirmedAt: LocalTimestamp;
  response: string;
  source: "chat" | "manual";
}

export interface Reminder {
  id: ID;
  familyMemberId: ID;
  title: string;
  kind: ReminderKind;
  time: TimeKey;
  frequency: ReminderFrequency;
  /** For `once` reminders. */
  date?: DateKey;
  /** For `weekly` reminders, 0 = Sunday. */
  weekday?: number;
  status: ReminderLifecycle;
  createdAt: LocalTimestamp;
  source: "wispr" | "manual" | "sample";
  confirmationHistory: Confirmation[];
  /** Authoritative medicine record this dose or refill reminder belongs to. */
  medicineId?: ID;
  reminderRole?: "dose" | "refill";
}

export type MedicineCourseStatus = "active" | "paused" | "completed" | "stopped" | "archived";
export type MedicineFrequency = "daily" | "twice_daily" | "weekly" | "as_needed" | "custom";
export type MedicineSource = "prescription" | "document" | "manual" | "other";
export type MedicineReminderSetup = "scheduled" | "paused" | "needs_setup";

export interface MedicineChange {
  id: ID;
  at: LocalTimestamp;
  actor?: string;
  summary: string;
  previous?: Record<string, string | undefined>;
}

export interface Medicine {
  id: ID;
  familyMemberId: ID;
  name: string;
  strength?: string;
  dosage?: string;
  route?: string;
  frequency: MedicineFrequency;
  times: TimeKey[];
  startDate: DateKey;
  endDate?: DateKey;
  ongoing: boolean;
  status: MedicineCourseStatus;
  prescriber?: string;
  instructions?: string;
  source: MedicineSource;
  documentId?: ID;
  notes?: string;
  reminderSetup: MedicineReminderSetup;
  createdAt: LocalTimestamp;
  updatedAt: LocalTimestamp;
  recordedBy?: string;
  changeHistory: MedicineChange[];
}

export type RefillStatus = "upcoming" | "due" | "completed" | "snoozed" | "cancelled";

export interface MedicineRefill {
  id: ID;
  medicineId: ID;
  familyMemberId: ID;
  remainingQuantity?: number;
  unit?: string;
  unitsPerDose?: number;
  plannedDate?: DateKey;
  reminderDate?: DateKey;
  reminderTime?: TimeKey;
  status: RefillStatus;
  notes?: string;
  createdAt: LocalTimestamp;
  updatedAt: LocalTimestamp;
}

export interface AppointmentReminder {
  id: ID;
  label: string;
  offsetMinutes: number;
  enabled: boolean;
}

export type AppointmentStatus = "upcoming" | "completed" | "cancelled";
export type DoctorCategory = "primary" | "specialist";

export interface FamilyDoctor {
  id: ID;
  name: string;
  specialty?: string;
  category: DoctorCategory;
  clinic?: string;
  address?: string;
  phone?: string;
  notes?: string;
  documentIds: ID[];
  recipientIds: ID[];
  archived: boolean;
  createdAt: LocalTimestamp;
  source: "manual" | "sample";
}

export interface VisitRecord {
  actualDate?: DateKey;
  familyNotes?: string;
  instructions?: string;
  followUpRecommended?: boolean;
  followUpDate?: DateKey;
  recordedAt: LocalTimestamp;
}

export interface Appointment {
  id: ID;
  familyMemberId: ID;
  doctor: string;
  doctorId?: ID;
  doctorCategory?: DoctorCategory;
  specialty?: string;
  clinic?: string;
  date: DateKey;
  time: TimeKey;
  location?: string;
  purpose?: string;
  notes?: string;
  documentIds: ID[];
  reminders: AppointmentReminder[];
  status: AppointmentStatus;
  createdAt: LocalTimestamp;
  createdBy?: string;
  source: "wispr" | "manual" | "sample";
  followUpOfId?: ID;
  followUpDate?: DateKey;
  followUpPurpose?: string;
  visit?: VisitRecord;
}

export type DocumentType = "report" | "prescription" | "scan" | "note" | "other";
export type ExtractStatus = "queued" | "processing" | "needs_review" | "confirmed" | "failed" | "not_extracted";

export interface DocumentFile {
  name: string;
  size: number;
  mime: string;
  /** `sample` files render a built-in fictional preview; `local` files live in this browser's IndexedDB. */
  storage: "sample" | "local";
}

export interface HealthDocument {
  id: ID;
  familyMemberId: ID;
  name: string;
  type: DocumentType;
  date: DateKey;
  doctor?: string;
  file: DocumentFile;
  metadata: {
    source: "sample" | "upload";
    /** How SMARAN decided the details. Never OCR in this prototype. */
    detectedFrom: "sample" | "filename" | "description" | "manual";
    description?: string;
    extractStatus?: ExtractStatus;
    extractProvider?: "none" | "local_text" | "demo";
    extractError?: string;
    checksum?: string;
    reportedPatient?: string;
  };
  linkedAppointmentId?: ID;
  addedAt: LocalTimestamp;
}

export type MeasurementKind = "blood_pressure" | "blood_sugar" | "weight" | "heart_rate" | "temperature" | "spo2" | "other";
export type GlucoseContext = "fasting" | "post_meal" | "random";
export type MeasurementConfirmation = "family_reported" | "confirmed" | "needs_review";

export interface HealthMeasurement {
  id: ID;
  familyMemberId: ID;
  kind: MeasurementKind;
  value: string;
  unit: string;
  systolic?: number;
  diastolic?: number;
  customLabel?: string;
  glucoseContext?: GlucoseContext;
  recordedAt: LocalTimestamp;
  source: "wispr" | "manual" | "sample" | "document";
  documentId?: ID;
  recordedBy?: string;
  confirmation?: MeasurementConfirmation;
  /** Sample values are stored family notes, not clinical advice. */
  note?: string;
}

export type HistoryCategory = "illness" | "chronic" | "surgery" | "hospitalization" | "family_history";

export interface MedicalHistoryEntry {
  id: ID;
  familyMemberId: ID;
  category: HistoryCategory;
  name: string;
  status?: string;
  startDate?: DateKey;
  endDate?: DateKey;
  hospital?: string;
  relationship?: string;
  notes?: string;
  documentId?: ID;
  source: "manual" | "document" | "sample";
  recordedBy?: string;
  createdAt: LocalTimestamp;
  updatedAt: LocalTimestamp;
  previous?: Record<string, string | undefined>;
}

export type VaccinationStatus = "completed" | "upcoming" | "overdue" | "unknown";

export interface Vaccination {
  id: ID;
  familyMemberId: ID;
  name: string;
  dose?: string;
  receivedDate?: DateKey;
  nextDueDate?: DateKey;
  clinic?: string;
  documentId?: ID;
  notes?: string;
  source: "manual" | "document" | "sample";
  recordedBy?: string;
  createdAt: LocalTimestamp;
}

export interface DiaryEntry {
  id: ID;
  familyMemberId: ID;
  title: string;
  body: string;
  recordedAt: LocalTimestamp;
  recordedBy?: string;
  appointmentId?: ID;
  documentId?: ID;
  measurementId?: ID;
  source: "manual" | "sample";
}

export type MemoryEventType =
  | "reminder_created"
  | "reminder_updated"
  | "reminder_confirmed"
  | "reminder_snoozed"
  | "reminder_paused"
  | "reminder_resumed"
  | "reminder_deleted"
  | "reminder_flagged"
  | "appointment_created"
  | "appointment_updated"
  | "appointment_completed"
  | "document_added"
  | "document_linked"
  | "member_added"
  | "measurement_recorded"
  | "measurement_updated"
  | "measurement_deleted"
  | "medicine_created"
  | "medicine_updated"
  | "medicine_paused"
  | "medicine_resumed"
  | "medicine_completed"
  | "medicine_stopped"
  | "medicine_archived"
  | "refill_created"
  | "refill_updated"
  | "doctor_created"
  | "doctor_updated"
  | "followup_created"
  | "history_recorded"
  | "history_updated"
  | "vaccination_recorded"
  | "diary_recorded";

export interface MemoryEvent {
  id: ID;
  familyMemberId: ID;
  type: MemoryEventType;
  title: string;
  description?: string;
  timestamp: LocalTimestamp;
  source: "wispr" | "chat" | "manual" | "sample" | "upload" | "document";
  refId?: ID;
}

export interface ChatMessage {
  id: ID;
  from: "smaran" | "member" | "system";
  text: string;
  at: LocalTimestamp;
}

export type ConversationOutcome = "confirmed" | "snoozed" | "declined" | "flagged";

export interface Conversation {
  id: ID;
  familyMemberId: ID;
  reminderId: ID;
  date: DateKey;
  context: { title: string; time: TimeKey };
  messages: ChatMessage[];
  outcome?: ConversationOutcome;
  /** Real wall-clock ms when the reminder was sent, used to age the demo clock honestly. */
  startedAtMs: number;
}

export type Language = "en" | "hi";

export interface Settings {
  language: Language;
  reminderSound: "Gentle" | "Bell" | "Silent";
  wisprEnabled: boolean;
  notifications: boolean;
  familyUpdates: boolean;
}

export interface AppState {
  version: number;
  onboarded: boolean;
  user: { name: string };
  family: FamilyMember[];
  reminders: Reminder[];
  medicines: Medicine[];
  refills: MedicineRefill[];
  appointments: Appointment[];
  doctors: FamilyDoctor[];
  documents: HealthDocument[];
  measurements: HealthMeasurement[];
  medicalHistory: MedicalHistoryEntry[];
  vaccinations: Vaccination[];
  diary: DiaryEntry[];
  memory: MemoryEvent[];
  conversations: Conversation[];
  settings: Settings;
  /** Local family clock. Everything "today" is relative to this. */
  demoNow: LocalTimestamp;
  selectedDate: DateKey;
}
