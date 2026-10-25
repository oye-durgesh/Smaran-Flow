import type {
  Appointment,
  AppState,
  FamilyDoctor,
  Confirmation,
  FamilyMember,
  HealthDocument,
  HealthMeasurement,
  Medicine,
  MemoryEvent,
  Reminder,
} from "./types";
import { formatTime } from "./dates";

/**
 * Fictional demo family. Nothing here is real medical data; documents render
 * built-in sample previews that are clearly labelled as fictional.
 */
export const DEMO_TODAY = "2026-10-23";
export const DEMO_NOW = `${DEMO_TODAY}T10:30`;
export const STATE_VERSION = 6;

const family: FamilyMember[] = [
  {
    id: "mummy",
    name: "Mummy",
    relationship: "Mother",
    age: 58,
    phone: "+91 98100 00058",
    avatar: { initials: "M", tone: "peach" },
    createdAt: "2026-10-18T09:00",
  },
  {
    id: "papa",
    name: "Papa",
    relationship: "Father",
    age: 62,
    phone: "+91 98100 00062",
    avatar: { initials: "P", tone: "terracotta" },
    createdAt: "2026-10-18T09:00",
  },
];

function history(reminderId: string, entries: [string, string][]): Confirmation[] {
  return entries.map(([date, time], i) => ({
    id: `${reminderId}-c${i}`,
    date,
    confirmedAt: `${date}T${time}`,
    response: "Haan, le li.",
    source: "chat",
  }));
}

const reminders: Reminder[] = [
  {
    id: "r-mummy-morning",
    familyMemberId: "mummy",
    title: "Morning Medicine",
    kind: "medicine",
    time: "08:00",
    frequency: "daily",
    status: "active",
    createdAt: "2026-10-18T09:20",
    source: "sample",
    medicineId: "med-mummy-morning",
    reminderRole: "dose",
    confirmationHistory: history("r-mummy-morning", [
      ["2026-10-23", "08:05"],
      ["2026-10-22", "08:03"],
      ["2026-10-21", "08:12"],
      ["2026-10-20", "08:02"],
      ["2026-10-19", "08:06"],
      ["2026-10-18", "08:04"],
    ]),
  },
  {
    id: "r-mummy-bpcheck",
    familyMemberId: "mummy",
    title: "BP Check",
    kind: "check",
    time: "10:00",
    frequency: "daily",
    status: "active",
    createdAt: "2026-10-18T09:24",
    source: "sample",
    confirmationHistory: history("r-mummy-bpcheck", [
      ["2026-10-23", "10:12"],
      ["2026-10-22", "10:05"],
      ["2026-10-21", "10:20"],
      ["2026-10-20", "10:01"],
      ["2026-10-19", "10:09"],
      ["2026-10-18", "10:15"],
    ]),
  },
  {
    id: "r-mummy-bp",
    familyMemberId: "mummy",
    title: "BP Medicine",
    kind: "medicine",
    time: "21:00",
    frequency: "daily",
    status: "active",
    createdAt: "2026-10-20T18:40",
    source: "wispr",
    medicineId: "med-mummy-bp",
    reminderRole: "dose",
    confirmationHistory: history("r-mummy-bp", [
      ["2026-10-22", "21:02"],
      ["2026-10-21", "21:00"],
      ["2026-10-20", "21:04"],
    ]),
  },
  {
    id: "r-papa-morning",
    familyMemberId: "papa",
    title: "Morning Medicine",
    kind: "medicine",
    time: "08:30",
    frequency: "daily",
    status: "active",
    createdAt: "2026-10-18T09:30",
    source: "sample",
    medicineId: "med-papa-morning",
    reminderRole: "dose",
    confirmationHistory: history("r-papa-morning", [
      ["2026-10-23", "08:40"],
      ["2026-10-22", "08:35"],
      ["2026-10-20", "08:31"],
      ["2026-10-19", "08:44"],
      ["2026-10-18", "08:33"],
    ]),
  },
];

function sampleMedicine(
  id: string,
  familyMemberId: string,
  name: string,
  time: string,
  createdAt: string,
  extra: Partial<Medicine> = {},
): Medicine {
  return {
    id,
    familyMemberId,
    name,
    frequency: "daily",
    times: [time],
    startDate: "2026-10-18",
    ongoing: true,
    status: "active",
    source: "manual",
    reminderSetup: "scheduled",
    createdAt,
    updatedAt: createdAt,
    changeHistory: [{ id: `${id}-c0`, at: createdAt, summary: "Sample family record" }],
    ...extra,
  };
}

const medicines: Medicine[] = [
  sampleMedicine("med-mummy-morning", "mummy", "Morning Medicine", "08:00", "2026-10-18T09:20"),
  sampleMedicine("med-mummy-bp", "mummy", "BP Medicine", "21:00", "2026-10-20T18:40", { source: "manual", startDate: "2026-10-20" }),
  sampleMedicine("med-papa-morning", "papa", "Morning Medicine", "08:30", "2026-10-18T09:30"),
];

const standardReminders = (prefix: string) => [
  { id: `${prefix}-1d`, label: "1 day before", offsetMinutes: 1440, enabled: true },
  { id: `${prefix}-3h`, label: "3 hours before", offsetMinutes: 180, enabled: true },
];

const appointments: Appointment[] = [
  {
    id: "a-papa-sharma",
    familyMemberId: "papa",
    doctor: "Dr Sharma",
    date: "2026-10-23",
    time: "11:00",
    location: "City Hospital, Room 204",
    doctorId: "doc-sharma",
    clinic: "City Hospital",
    notes: "Follow-up visit. Carry the X-Ray report.",
    documentIds: ["d-papa-xray"],
    reminders: standardReminders("a-papa-sharma"),
    status: "upcoming",
    createdAt: "2026-10-16T19:10",
    source: "wispr",
  },
  {
    id: "a-mummy-sharma",
    familyMemberId: "mummy",
    doctor: "Dr Sharma",
    date: "2026-10-30",
    time: "11:00",
    location: "City Hospital, Room 204",
    doctorId: "doc-sharma",
    clinic: "City Hospital",
    notes: "Regular checkup. Bring previous reports.",
    documentIds: ["d-mummy-blood", "d-mummy-rx", "d-mummy-lab"],
    reminders: standardReminders("a-mummy-sharma"),
    status: "upcoming",
    createdAt: "2026-10-20T16:10",
    source: "wispr",
  },
  {
    id: "a-papa-patel",
    familyMemberId: "papa",
    doctor: "Dr Patel",
    date: "2026-11-02",
    time: "15:00",
    location: "Sunrise Heart Clinic, 2nd floor",
    doctorId: "doc-patel",
    doctorCategory: "specialist",
    specialty: "Cardiology",
    clinic: "Sunrise Heart Clinic",
    notes: "Review visit. Bring the ECG report.",
    documentIds: ["d-papa-ecg"],
    reminders: standardReminders("a-papa-patel"),
    status: "upcoming",
    createdAt: "2026-10-18T20:15",
    source: "wispr",
  },
  {
    id: "a-mummy-gupta",
    familyMemberId: "mummy",
    doctor: "Dr Gupta",
    date: "2026-10-15",
    time: "10:00",
    location: "Green Park Clinic",
    doctorId: "doc-gupta",
    clinic: "Green Park Clinic",
    notes: "Routine visit.",
    documentIds: [],
    visit: { actualDate: "2026-10-15", familyNotes: "Routine visit recorded by family.", recordedAt: "2026-10-15T11:05" },
    reminders: standardReminders("a-mummy-gupta").map((r) => ({ ...r, enabled: false })),
    status: "completed",
    createdAt: "2026-10-08T12:00",
    source: "manual",
  },
];

const doctors: FamilyDoctor[] = [
  { id: "doc-sharma", name: "Dr Sharma", category: "primary", clinic: "City Hospital", address: "City Hospital, Room 204", recipientIds: ["mummy", "papa"], documentIds: [], archived: false, createdAt: "2026-10-16T19:10", source: "sample" },
  { id: "doc-patel", name: "Dr Patel", category: "specialist", specialty: "Cardiology", clinic: "Sunrise Heart Clinic", address: "Sunrise Heart Clinic, 2nd floor", recipientIds: ["papa"], documentIds: [], archived: false, createdAt: "2026-10-18T20:15", source: "sample" },
  { id: "doc-gupta", name: "Dr Gupta", category: "specialist", clinic: "Green Park Clinic", recipientIds: ["mummy"], documentIds: [], archived: false, createdAt: "2026-10-08T12:00", source: "sample" },
];

function sampleDoc(
  id: string,
  familyMemberId: string,
  name: string,
  type: HealthDocument["type"],
  date: string,
  addedTime: string,
  fileName: string,
  extra: Partial<HealthDocument> = {},
): HealthDocument {
  return {
    id,
    familyMemberId,
    name,
    type,
    date,
    file: { name: fileName, size: 184_000, mime: "application/pdf", storage: "sample" },
    metadata: { source: "sample", detectedFrom: "sample" },
    addedAt: `${date}T${addedTime}`,
    ...extra,
  };
}

const documents: HealthDocument[] = [
  sampleDoc("d-mummy-blood", "mummy", "Blood Report", "report", "2026-10-21", "14:30", "blood_report_oct2026.pdf", {
    doctor: "Dr Sharma",
    linkedAppointmentId: "a-mummy-sharma",
  }),
  sampleDoc("d-mummy-rx", "mummy", "Prescription", "prescription", "2026-10-20", "17:05", "prescription_dr_sharma.pdf", {
    doctor: "Dr Sharma",
    linkedAppointmentId: "a-mummy-sharma",
  }),
  sampleDoc("d-mummy-lab", "mummy", "Lab Report", "report", "2026-10-12", "12:40", "lab_report_oct2026.pdf", {
    linkedAppointmentId: "a-mummy-sharma",
  }),
  sampleDoc("d-mummy-oldrx", "mummy", "Previous Prescription", "prescription", "2026-09-28", "18:20", "prescription_sep2026.pdf", {
    doctor: "Dr Gupta",
  }),
  sampleDoc("d-papa-ecg", "papa", "ECG Report", "report", "2026-10-18", "11:15", "ecg_report_oct2026.pdf", {
    doctor: "Dr Patel",
    linkedAppointmentId: "a-papa-patel",
  }),
  sampleDoc("d-papa-xray", "papa", "X-Ray Report", "scan", "2026-10-15", "16:45", "xray_chest_oct2026.pdf", {
    linkedAppointmentId: "a-papa-sharma",
  }),
  sampleDoc("d-papa-rx", "papa", "Prescription", "prescription", "2026-10-14", "19:30", "prescription_papa_oct2026.pdf", {
    doctor: "Dr Sharma",
  }),
];

/** Sample stored notes — labelled as family-saved sample data, not clinical readings. */
const measurements: HealthMeasurement[] = [
  { id: "h-mummy-bp", familyMemberId: "mummy", kind: "blood_pressure", value: "120/80", unit: "mmHg", recordedAt: "2026-10-23T10:02", source: "sample", note: "Sample family note" },
  { id: "h-mummy-sugar", familyMemberId: "mummy", kind: "blood_sugar", value: "108", unit: "mg/dL", recordedAt: "2026-10-21T14:30", source: "sample", documentId: "d-mummy-blood", note: "Sample value stored with Blood Report" },
  { id: "h-mummy-weight", familyMemberId: "mummy", kind: "weight", value: "64", unit: "kg", recordedAt: "2026-10-20T08:10", source: "sample", note: "Sample family note" },
  { id: "h-mummy-hr", familyMemberId: "mummy", kind: "heart_rate", value: "74", unit: "bpm", recordedAt: "2026-10-23T10:02", source: "sample", note: "Sample family note" },
  { id: "h-papa-bp", familyMemberId: "papa", kind: "blood_pressure", value: "128/84", unit: "mmHg", recordedAt: "2026-10-22T09:15", source: "sample", note: "Sample family note" },
  { id: "h-papa-sugar", familyMemberId: "papa", kind: "blood_sugar", value: "112", unit: "mg/dL", recordedAt: "2026-10-22T08:40", source: "sample", note: "Sample family note" },
  { id: "h-papa-hr", familyMemberId: "papa", kind: "heart_rate", value: "68", unit: "bpm", recordedAt: "2026-10-22T08:40", source: "sample", note: "Sample family note" },
];

function seedMemory(): MemoryEvent[] {
  const events: MemoryEvent[] = [];
  const name = (id: string) => family.find((f) => f.id === id)?.name ?? "";

  for (const r of reminders) {
    events.push({
      id: `m-${r.id}-created`,
      familyMemberId: r.familyMemberId,
      type: "reminder_created",
      title: `${r.title} reminder created`,
      description: `Every day · ${formatTime(r.time)}`,
      timestamp: r.createdAt,
      source: r.source === "wispr" ? "wispr" : "manual",
      refId: r.id,
    });
    for (const c of r.confirmationHistory) {
      events.push({
        id: `m-${c.id}`,
        familyMemberId: r.familyMemberId,
        type: "reminder_confirmed",
        title: `${r.title} confirmed`,
        description: `${name(r.familyMemberId)} replied “${c.response}”`,
        timestamp: c.confirmedAt,
        source: "chat",
        refId: r.id,
      });
    }
  }

  for (const a of appointments) {
    events.push({
      id: `m-${a.id}-created`,
      familyMemberId: a.familyMemberId,
      type: "appointment_created",
      title: `${a.doctor} appointment created`,
      description: `${a.location ?? ""}`.trim() || undefined,
      timestamp: a.createdAt,
      source: a.source === "wispr" ? "wispr" : "manual",
      refId: a.id,
    });
  }
  events.push({
    id: "m-a-mummy-gupta-done",
    familyMemberId: "mummy",
    type: "appointment_completed",
    title: "Dr Gupta appointment completed",
    description: "Green Park Clinic",
    timestamp: "2026-10-15T11:05",
    source: "manual",
    refId: "a-mummy-gupta",
  });

  for (const m of measurements) {
    events.push({
      id: `m-${m.id}`,
      familyMemberId: m.familyMemberId,
      type: "measurement_recorded",
      title: `${m.kind === "blood_pressure" ? "Blood pressure" : m.kind === "blood_sugar" ? "Blood sugar" : "Weight"} recorded`,
      description: `${m.value} ${m.unit} · sample family note`,
      timestamp: m.recordedAt,
      source: "sample",
      refId: m.id,
    });
  }

  for (const d of documents) {
    events.push({
      id: `m-${d.id}-added`,
      familyMemberId: d.familyMemberId,
      type: "document_added",
      title: `${d.name} added`,
      description: d.doctor ? `From ${d.doctor}` : undefined,
      timestamp: d.addedAt,
      source: "sample",
      refId: d.id,
    });
  }

  return events.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export function createDemoState(): AppState {
  return structuredClone({
    version: STATE_VERSION,
    onboarded: false,
    user: { name: "Rahul" },
    family,
    reminders,
    medicines,
    refills: [],
    appointments,
    doctors,
    documents,
    measurements,
    memory: seedMemory(),
    conversations: [],
    settings: {
      language: "en",
      reminderSound: "Gentle",
      wisprEnabled: true,
      notifications: true,
      familyUpdates: true,
    },
    demoNow: DEMO_NOW,
    selectedDate: DEMO_TODAY,
  } satisfies AppState);
}

export function createEmptyState(): AppState {
  const base = createDemoState();
  return {
    ...base,
    onboarded: true,
    family: base.family,
    reminders: [],
    medicines: [],
    refills: [],
    appointments: [],
    doctors: [],
    documents: [],
    measurements: [],
    memory: [],
    conversations: [],
  };
}
