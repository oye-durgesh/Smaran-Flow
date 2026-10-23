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

export type ReminderKind = "medicine" | "check" | "other";
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
}

export interface AppointmentReminder {
  id: ID;
  label: string;
  offsetMinutes: number;
  enabled: boolean;
}

export type AppointmentStatus = "upcoming" | "completed";

export interface Appointment {
  id: ID;
  familyMemberId: ID;
  doctor: string;
  date: DateKey;
  time: TimeKey;
  location?: string;
  notes?: string;
  documentIds: ID[];
  reminders: AppointmentReminder[];
  status: AppointmentStatus;
  createdAt: LocalTimestamp;
  source: "wispr" | "manual" | "sample";
}

export type DocumentType = "report" | "prescription" | "scan" | "note" | "other";

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
  };
  linkedAppointmentId?: ID;
  addedAt: LocalTimestamp;
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
  | "member_added";

export interface MemoryEvent {
  id: ID;
  familyMemberId: ID;
  type: MemoryEventType;
  title: string;
  description?: string;
  timestamp: LocalTimestamp;
  source: "wispr" | "chat" | "manual" | "sample" | "upload";
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
  appointments: Appointment[];
  documents: HealthDocument[];
  memory: MemoryEvent[];
  conversations: Conversation[];
  settings: Settings;
  /** The demo clock. Everything "today" is relative to this. */
  demoNow: LocalTimestamp;
  selectedDate: DateKey;
}

export type ViewMode = "mobile" | "web";
