import { addDays, dateOf, stamp } from "@/lib/dates";
import type {
  AppState,
  Appointment,
  DiaryEntry,
  FamilyDoctor,
  FamilyMember,
  HealthDocument,
  HealthMeasurement,
  MedicalHistoryEntry,
  Medicine,
  MedicineRefill,
  MemoryEvent,
  Reminder,
  Vaccination,
} from "@/lib/types";
import { DEMO_RECORD_LABEL, DEMO_SEED_VERSION } from "./workspace";

export const DEMO_PEOPLE = [
  { key: "mummy", name: "Mummy", relationship: "Mother", age: 58, colorKey: "mummy" },
  { key: "papa", name: "Papa", relationship: "Father", age: 62, colorKey: "papa" },
  { key: "dadi", name: "Dadi", relationship: "Grandmother", age: 78, colorKey: "dadi" },
  { key: "dada", name: "Dada Ji", relationship: "Grandfather", age: 82, colorKey: "clay" },
] as const;

export type DemoPersonKey = (typeof DEMO_PEOPLE)[number]["key"];

/** Specified demo BP pairs, oldest → newest. */
export const DEMO_BP: Record<DemoPersonKey, readonly [number, number][]> = {
  mummy: [
    [128, 82], [126, 80], [131, 84], [124, 78], [130, 82], [127, 81], [125, 79], [132, 83], [126, 80], [129, 82],
  ],
  papa: [
    [136, 86], [134, 84], [140, 88], [132, 82], [138, 86], [135, 85], [130, 80], [137, 84], [133, 83], [136, 85],
  ],
  dadi: [
    [142, 88], [138, 86], [145, 90], [140, 84], [136, 82], [139, 85], [143, 87], [137, 83], [141, 86], [138, 84],
  ],
  dada: [
    [138, 84], [142, 86], [136, 82], [140, 85], [134, 80], [139, 83], [137, 81], [143, 87], [135, 82], [138, 84],
  ],
};

export const DEMO_GLUCOSE: Record<DemoPersonKey, readonly number[]> = {
  mummy: [112, 108, 116, 105, 118, 110, 107, 114, 111, 109],
  papa: [102, 98, 105, 101, 110, 99, 104, 96, 107, 100],
  dadi: [124, 119, 131, 122, 128, 116, 125, 120, 127, 118],
  dada: [146, 139, 152, 134, 141, 128, 149, 136, 143, 132],
};

const HR: Record<DemoPersonKey, readonly number[]> = {
  mummy: [72, 74, 70, 73, 71, 75, 69, 72, 74, 71],
  papa: [68, 70, 66, 69, 71, 67, 65, 70, 68, 69],
  dadi: [76, 78, 74, 77, 75, 79, 73, 76, 78, 75],
  dada: [70, 72, 68, 71, 69, 73, 67, 70, 72, 69],
};

const WEIGHT: Record<DemoPersonKey, readonly number[]> = {
  mummy: [64.2, 64.0, 64.4, 63.8, 64.1, 64.3, 63.9, 64.2, 64.0, 64.1],
  papa: [78.4, 78.1, 78.6, 78.0, 78.3, 78.5, 77.9, 78.2, 78.1, 78.3],
  dadi: [58.6, 58.4, 58.8, 58.2, 58.5, 58.7, 58.3, 58.6, 58.4, 58.5],
  dada: [71.2, 71.0, 71.4, 70.8, 71.1, 71.3, 70.9, 71.2, 71.0, 71.1],
};

const TEMP: Record<DemoPersonKey, readonly number[]> = {
  mummy: [36.6, 36.5, 36.7, 36.4, 36.6, 36.8, 36.5, 36.6, 36.7, 36.5],
  papa: [36.5, 36.4, 36.6, 36.5, 36.7, 36.4, 36.5, 36.6, 36.5, 36.6],
  dadi: [36.7, 36.6, 36.8, 36.5, 36.7, 36.9, 36.6, 36.7, 36.8, 36.6],
  dada: [36.6, 36.5, 36.7, 36.4, 36.6, 36.8, 36.5, 36.6, 36.7, 36.5],
};

const SPO2: Record<DemoPersonKey, readonly number[]> = {
  mummy: [98, 97, 98, 99, 97, 98, 98, 97, 99, 98],
  papa: [97, 96, 98, 97, 96, 97, 98, 97, 96, 97],
  dadi: [96, 95, 97, 96, 95, 96, 97, 96, 95, 96],
  dada: [96, 95, 96, 97, 95, 96, 96, 95, 97, 96],
};

function readingDates(referenceDate: string): string[] {
  return Array.from({ length: 10 }, (_, i) => addDays(referenceDate, -7 * (9 - i)));
}

export function specifiedMeasurements(person: DemoPersonKey, referenceDate: string) {
  const dates = readingDates(referenceDate);
  const rows: {
    seedKey: string;
    person: DemoPersonKey;
    kind: "blood_pressure" | "blood_sugar" | "heart_rate" | "weight" | "temperature" | "spo2";
    value: string;
    unit: string;
    systolic?: number;
    diastolic?: number;
    glucoseContext?: "fasting";
    recordedAt: string;
    note: string;
  }[] = [];
  DEMO_BP[person].forEach(([sys, dia], i) => {
    const date = dates[i];
    rows.push({
      seedKey: `meas-${person}-bp-${date}`,
      person,
      kind: "blood_pressure",
      value: `${sys}/${dia}`,
      unit: "mmHg",
      systolic: sys,
      diastolic: dia,
      recordedAt: stamp(date, "09:00"),
      note: `${DEMO_RECORD_LABEL}. Fictional BP fixture — not a clinical reading.`,
    });
  });
  DEMO_GLUCOSE[person].forEach((glu, i) => {
    const date = dates[i];
    rows.push({
      seedKey: `meas-${person}-glu-${date}`,
      person,
      kind: "blood_sugar",
      value: String(glu),
      unit: "mg/dL",
      glucoseContext: "fasting",
      recordedAt: stamp(date, "07:45"),
      note: `${DEMO_RECORD_LABEL}. Fictional fasting glucose fixture.`,
    });
  });
  dates.forEach((date, i) => {
    rows.push({
      seedKey: `meas-${person}-hr-${date}`,
      person,
      kind: "heart_rate",
      value: String(HR[person][i]),
      unit: "bpm",
      recordedAt: stamp(date, "09:10"),
      note: `${DEMO_RECORD_LABEL}. Fictional heart-rate fixture.`,
    });
    rows.push({
      seedKey: `meas-${person}-wt-${date}`,
      person,
      kind: "weight",
      value: String(WEIGHT[person][i]),
      unit: "kg",
      recordedAt: stamp(date, "07:30"),
      note: `${DEMO_RECORD_LABEL}. Fictional weight fixture.`,
    });
    rows.push({
      seedKey: `meas-${person}-temp-${date}`,
      person,
      kind: "temperature",
      value: String(TEMP[person][i]),
      unit: "°C",
      recordedAt: stamp(date, "08:15"),
      note: `${DEMO_RECORD_LABEL}. Fictional temperature fixture.`,
    });
    rows.push({
      seedKey: `meas-${person}-spo2-${date}`,
      person,
      kind: "spo2",
      value: String(SPO2[person][i]),
      unit: "%",
      recordedAt: stamp(date, "09:20"),
      note: `${DEMO_RECORD_LABEL}. Fictional SpO₂ fixture.`,
    });
  });
  return rows;
}

/** Backward-compatible alias used by older tests. */
export function weeklyMeasurements(person: DemoPersonKey, referenceDate: string) {
  return specifiedMeasurements(person, referenceDate).filter((r) => r.kind === "blood_pressure" || r.kind === "blood_sugar");
}

export function buildDemoDataset(referenceDate: string) {
  const created = stamp(addDays(referenceDate, -40), "09:00");
  const people = DEMO_PEOPLE.map((p) => ({ ...p, seedKey: `person-${p.key}` }));

  const doctors = [
    { seedKey: "doc-sharma", name: "Dr Sharma", category: "primary" as const, specialty: "General Physician", clinic: "Fictional City Clinic" },
    { seedKey: "doc-mehta", name: "Dr Mehta", category: "specialist" as const, specialty: "Cardiology", clinic: "Fictional Heart Centre" },
    { seedKey: "doc-kapoor", name: "Dr Kapoor", category: "specialist" as const, specialty: "Endocrinology", clinic: "Fictional Sugar Clinic" },
    { seedKey: "doc-verma", name: "Dr Verma", category: "specialist" as const, specialty: "Orthopedics", clinic: "Fictional Joint Clinic" },
    { seedKey: "doc-nair", name: "Dr Nair", category: "specialist" as const, specialty: "Ophthalmology", clinic: "Fictional Eye Desk" },
    { seedKey: "doc-rao", name: "Dr Rao", category: "specialist" as const, specialty: "Dental", clinic: "Fictional Dental Studio" },
    { seedKey: "doc-iyer", name: "Dr Iyer", category: "specialist" as const, specialty: "Laboratory", clinic: "Fictional Lab Desk" },
  ];

  const medicines = [
    { seedKey: "med-mummy-aml", person: "mummy" as const, name: "Amlodipine", strength: "5 mg", dosage: "1 tablet", times: ["08:00"], frequency: "daily" as const, status: "active" as const, ongoing: true, prescriber: "Dr Sharma (demo clinic)" },
    { seedKey: "med-mummy-met", person: "mummy" as const, name: "Metformin", strength: "500 mg", dosage: "1 tablet", times: ["08:00", "20:00"], frequency: "twice_daily" as const, status: "active" as const, ongoing: true, prescriber: "Dr Kapoor (demo clinic)" },
    { seedKey: "med-mummy-los", person: "mummy" as const, name: "Losartan", strength: "25 mg", dosage: "1 tablet", times: ["21:00"], frequency: "daily" as const, status: "active" as const, ongoing: true, prescriber: "Dr Sharma (demo clinic)" },
    { seedKey: "med-mummy-cal", person: "mummy" as const, name: "Calcium + Vitamin D", strength: "500 mg", dosage: "1 tablet", times: ["21:30"], frequency: "daily" as const, status: "active" as const, ongoing: true, prescriber: "Dr Sharma (demo clinic)" },
    { seedKey: "med-mummy-old", person: "mummy" as const, name: "Telmisartan", strength: "40 mg", dosage: "1 tablet", times: ["21:00"], frequency: "daily" as const, status: "stopped" as const, ongoing: false, endOffset: -60, prescriber: "Dr Sharma (demo clinic)" },
    { seedKey: "med-papa-aml", person: "papa" as const, name: "Amlodipine", strength: "5 mg", dosage: "1 tablet", times: ["08:30"], frequency: "daily" as const, status: "active" as const, ongoing: true, prescriber: "Dr Mehta (demo clinic)" },
    { seedKey: "med-papa-ator", person: "papa" as const, name: "Atorvastatin", strength: "10 mg", dosage: "1 tablet", times: ["21:30"], frequency: "daily" as const, status: "active" as const, ongoing: true, prescriber: "Dr Mehta (demo clinic)" },
    { seedKey: "med-papa-met", person: "papa" as const, name: "Metformin", strength: "500 mg", dosage: "1 tablet", times: ["09:00"], frequency: "daily" as const, status: "active" as const, ongoing: true, prescriber: "Dr Kapoor (demo clinic)" },
    { seedKey: "med-papa-b12", person: "papa" as const, name: "Vitamin B12", strength: "1500 mcg", dosage: "1 tablet", times: ["10:00"], frequency: "weekly" as const, status: "active" as const, ongoing: true, prescriber: "Dr Sharma (demo clinic)" },
    { seedKey: "med-papa-old", person: "papa" as const, name: "Losartan", strength: "25 mg", dosage: "1 tablet", times: ["09:00"], frequency: "daily" as const, status: "stopped" as const, ongoing: false, endOffset: -90, prescriber: "Dr Mehta (demo clinic)" },
    { seedKey: "med-dadi-levo", person: "dadi" as const, name: "Levothyroxine", strength: "50 mcg", dosage: "1 tablet", times: ["07:00"], frequency: "daily" as const, status: "active" as const, ongoing: true, prescriber: "Dr Sharma (demo clinic)" },
    { seedKey: "med-dadi-cal", person: "dadi" as const, name: "Calcium + Vitamin D", strength: "500 mg", dosage: "1 tablet", times: ["21:00"], frequency: "daily" as const, status: "active" as const, ongoing: true, prescriber: "Dr Verma (demo clinic)" },
    { seedKey: "med-dadi-aml", person: "dadi" as const, name: "Amlodipine", strength: "2.5 mg", dosage: "1 tablet", times: ["08:00"], frequency: "daily" as const, status: "active" as const, ongoing: true, prescriber: "Dr Mehta (demo clinic)" },
    { seedKey: "med-dadi-b12", person: "dadi" as const, name: "Vitamin B12", strength: "1500 mcg", dosage: "1 tablet", times: ["10:00"], frequency: "weekly" as const, status: "active" as const, ongoing: true, prescriber: "Dr Sharma (demo clinic)" },
    { seedKey: "med-dada-aml", person: "dada" as const, name: "Amlodipine", strength: "2.5 mg", dosage: "1 tablet", times: ["08:00"], frequency: "daily" as const, status: "active" as const, ongoing: true, prescriber: "Dr Sharma (demo clinic)" },
    { seedKey: "med-dada-ator", person: "dada" as const, name: "Atorvastatin", strength: "10 mg", dosage: "1 tablet", times: ["21:00"], frequency: "daily" as const, status: "active" as const, ongoing: true, prescriber: "Dr Mehta (demo clinic)" },
    { seedKey: "med-dada-cal", person: "dada" as const, name: "Calcium + Vitamin D", strength: "500 mg", dosage: "1 tablet", times: ["21:15"], frequency: "daily" as const, status: "active" as const, ongoing: true, prescriber: "Dr Sharma (demo clinic)" },
    { seedKey: "med-dada-b12", person: "dada" as const, name: "Vitamin B12", strength: "1500 mcg", dosage: "1 tablet", times: ["10:00"], frequency: "weekly" as const, status: "active" as const, ongoing: true, prescriber: "Dr Sharma (demo clinic)" },
    { seedKey: "med-dada-done", person: "dada" as const, name: "Losartan", strength: "25 mg", dosage: "1 tablet", times: ["09:00"], frequency: "daily" as const, status: "completed" as const, ongoing: false, endOffset: -20, prescriber: "Dr Mehta (demo clinic)" },
  ];

  const refills = [
    { seedKey: "refill-mummy-met", medicine: "med-mummy-met", person: "mummy" as const, remaining: 8, unit: "tablets", perDose: 1, days: 3 },
    { seedKey: "refill-papa-aml", medicine: "med-papa-aml", person: "papa" as const, remaining: 12, unit: "tablets", perDose: 1, days: 6 },
    { seedKey: "refill-dadi-cal", medicine: "med-dadi-cal", person: "dadi" as const, remaining: 6, unit: "tablets", perDose: 1, days: 4 },
    { seedKey: "refill-dada-ator", medicine: "med-dada-ator", person: "dada" as const, remaining: 10, unit: "tablets", perDose: 1, days: 8 },
  ];

  const doseReminders = medicines
    .filter((m) => m.status === "active")
    .flatMap((m) =>
      m.times.map((time, i) => ({
        seedKey: `rem-${m.seedKey}-${i}`,
        person: m.person,
        title: `${m.name} dose`,
        kind: "medicine" as const,
        time,
        recurrence: m.frequency === "weekly" ? ("weekly" as const) : ("daily" as const),
        medicine: m.seedKey,
        role: "dose" as const,
        date: undefined as string | undefined,
      })),
    );
  const refillReminders = refills.map((r) => ({
    seedKey: `rem-${r.seedKey}`,
    person: r.person,
    title: `Refill ${r.medicine.replace(/^med-[^-]+-/, "")}`,
    kind: "pickup" as const,
    time: "18:00",
    recurrence: "once" as const,
    medicine: r.medicine,
    role: "refill" as const,
    date: addDays(referenceDate, r.days) as string | undefined,
  }));

  const careTasks = DEMO_PEOPLE.flatMap((p) => {
    const key = p.key;
    return [
      { seedKey: `task-${key}-bp`, person: key, title: "Check BP", kind: "check" as const, time: "09:00", recurrence: "daily" as const, date: undefined, done: key === "mummy" },
      { seedKey: `task-${key}-glu`, person: key, title: "Record fasting glucose", kind: "check" as const, time: "07:30", recurrence: "daily" as const, date: undefined, done: key === "papa" },
      { seedKey: `task-${key}-meds`, person: key, title: "Review morning medicine schedule", kind: "other" as const, time: "08:15", recurrence: "daily" as const, date: undefined, done: false },
      { seedKey: `task-${key}-stock`, person: key, title: "Check remaining medicine supply", kind: "other" as const, time: "18:30", recurrence: "once" as const, date: addDays(referenceDate, 1), done: false },
      { seedKey: `task-${key}-prep`, person: key, title: "Prepare for a scheduled appointment", kind: "other" as const, time: "19:00", recurrence: "once" as const, date: addDays(referenceDate, 2), done: false },
      { seedKey: `task-${key}-report`, person: key, title: "Review a blood-test report", kind: "other" as const, time: "16:00", recurrence: "once" as const, date: addDays(referenceDate, -1), done: true },
      { seedKey: `task-${key}-lab`, person: key, title: "Arrange a laboratory test", kind: "other" as const, time: "11:00", recurrence: "once" as const, date: addDays(referenceDate, 5), done: false },
      { seedKey: `task-${key}-docs`, person: key, title: "Help organise health documents", kind: "other" as const, time: "17:00", recurrence: "once" as const, date: addDays(referenceDate, 3), done: false },
    ];
  });

  const extraReminders = [
    { seedKey: "rem-due-now", person: "mummy" as const, title: "Due demo reminder — review evening medicines", kind: "other" as const, time: "08:00", recurrence: "once" as const, date: referenceDate, medicine: undefined, role: undefined },
    { seedKey: "rem-upcoming-soon", person: "papa" as const, title: "Upcoming demo reminder — BP follow-up prep", kind: "check" as const, time: "20:00", recurrence: "once" as const, date: addDays(referenceDate, 1), medicine: undefined, role: undefined },
  ];

  const reminders = [
    ...doseReminders,
    ...refillReminders,
    ...careTasks.map((t) => ({
      seedKey: t.seedKey,
      person: t.person,
      title: t.title,
      kind: t.kind,
      time: t.time,
      recurrence: t.recurrence,
      medicine: undefined as string | undefined,
      role: undefined as "dose" | "refill" | undefined,
      date: t.date,
      done: t.done,
    })),
    ...extraReminders,
  ];

  const appointmentSpecs: {
    seedKey: string;
    person: DemoPersonKey;
    doctor: string;
    doctorKey: string;
    day: number;
    time: string;
    status: "upcoming" | "completed" | "cancelled";
    clinic: string;
    purpose: string;
    follow?: number;
  }[] = [
    { seedKey: "apt-mummy-gp-soon", person: "mummy", doctor: "Dr Sharma", doctorKey: "doc-sharma", day: 3, time: "10:00", status: "upcoming", clinic: "Fictional City Clinic", purpose: "General physician review (demo)" },
    { seedKey: "apt-mummy-bp-soon", person: "mummy", doctor: "Dr Mehta", doctorKey: "doc-mehta", day: 9, time: "16:00", status: "upcoming", clinic: "Fictional Heart Centre", purpose: "BP follow-up (demo)" },
    { seedKey: "apt-mummy-glu-soon", person: "mummy", doctor: "Dr Kapoor", doctorKey: "doc-kapoor", day: 14, time: "11:30", status: "upcoming", clinic: "Fictional Sugar Clinic", purpose: "Diabetes follow-up (demo)" },
    { seedKey: "apt-mummy-gp-past", person: "mummy", doctor: "Dr Sharma", doctorKey: "doc-sharma", day: -18, time: "10:00", status: "completed", clinic: "Fictional City Clinic", purpose: "Routine health review (demo)", follow: 21 },
    { seedKey: "apt-mummy-lab-past", person: "mummy", doctor: "Dr Iyer", doctorKey: "doc-iyer", day: -28, time: "08:30", status: "completed", clinic: "Fictional Lab Desk", purpose: "Laboratory test (demo)" },
    { seedKey: "apt-mummy-eye-past", person: "mummy", doctor: "Dr Nair", doctorKey: "doc-nair", day: -40, time: "15:00", status: "completed", clinic: "Fictional Eye Desk", purpose: "Eye examination (demo)" },
    { seedKey: "apt-papa-card-soon", person: "papa", doctor: "Dr Mehta", doctorKey: "doc-mehta", day: 5, time: "15:00", status: "upcoming", clinic: "Fictional Heart Centre", purpose: "Cardiology follow-up (demo)" },
    { seedKey: "apt-papa-den-soon", person: "papa", doctor: "Dr Rao", doctorKey: "doc-rao", day: 11, time: "09:45", status: "upcoming", clinic: "Fictional Dental Studio", purpose: "Dental check-up (demo)" },
    { seedKey: "apt-papa-lab-soon", person: "papa", doctor: "Dr Iyer", doctorKey: "doc-iyer", day: 16, time: "08:15", status: "upcoming", clinic: "Fictional Lab Desk", purpose: "Laboratory test (demo)" },
    { seedKey: "apt-papa-card-past", person: "papa", doctor: "Dr Mehta", doctorKey: "doc-mehta", day: -21, time: "16:00", status: "completed", clinic: "Fictional Heart Centre", purpose: "Cardiology consult (demo)", follow: 30 },
    { seedKey: "apt-papa-gp-past", person: "papa", doctor: "Dr Sharma", doctorKey: "doc-sharma", day: -35, time: "11:00", status: "completed", clinic: "Fictional City Clinic", purpose: "General physician visit (demo)" },
    { seedKey: "apt-papa-eye-past", person: "papa", doctor: "Dr Nair", doctorKey: "doc-nair", day: -48, time: "17:00", status: "completed", clinic: "Fictional Eye Desk", purpose: "Eye examination (demo)" },
    { seedKey: "apt-dadi-ortho-soon", person: "dadi", doctor: "Dr Verma", doctorKey: "doc-verma", day: 6, time: "11:00", status: "upcoming", clinic: "Fictional Joint Clinic", purpose: "Mobility review (demo)" },
    { seedKey: "apt-dadi-gp-soon", person: "dadi", doctor: "Dr Sharma", doctorKey: "doc-sharma", day: 13, time: "10:20", status: "upcoming", clinic: "Fictional City Clinic", purpose: "Routine health review (demo)" },
    { seedKey: "apt-dadi-lab-soon", person: "dadi", doctor: "Dr Iyer", doctorKey: "doc-iyer", day: 19, time: "08:40", status: "upcoming", clinic: "Fictional Lab Desk", purpose: "Laboratory test (demo)" },
    { seedKey: "apt-dadi-ortho-past", person: "dadi", doctor: "Dr Verma", doctorKey: "doc-verma", day: -10, time: "12:00", status: "completed", clinic: "Fictional Joint Clinic", purpose: "Orthopedic consult (demo)" },
    { seedKey: "apt-dadi-den-past", person: "dadi", doctor: "Dr Rao", doctorKey: "doc-rao", day: -24, time: "14:00", status: "completed", clinic: "Fictional Dental Studio", purpose: "Dental check-up (demo)" },
    { seedKey: "apt-dadi-gp-past", person: "dadi", doctor: "Dr Sharma", doctorKey: "doc-sharma", day: -38, time: "09:30", status: "completed", clinic: "Fictional City Clinic", purpose: "General physician visit (demo)" },
    { seedKey: "apt-dada-gp-soon", person: "dada", doctor: "Dr Sharma", doctorKey: "doc-sharma", day: 4, time: "09:30", status: "upcoming", clinic: "Fictional City Clinic", purpose: "Annual checkup (demo)" },
    { seedKey: "apt-dada-card-soon", person: "dada", doctor: "Dr Mehta", doctorKey: "doc-mehta", day: 10, time: "15:30", status: "upcoming", clinic: "Fictional Heart Centre", purpose: "Cardiology follow-up (demo)" },
    { seedKey: "apt-dada-eye-soon", person: "dada", doctor: "Dr Nair", doctorKey: "doc-nair", day: 17, time: "16:15", status: "upcoming", clinic: "Fictional Eye Desk", purpose: "Eye examination (demo)" },
    { seedKey: "apt-dada-gp-past", person: "dada", doctor: "Dr Sharma", doctorKey: "doc-sharma", day: -15, time: "09:00", status: "completed", clinic: "Fictional City Clinic", purpose: "General history (demo)" },
    { seedKey: "apt-dada-lab-past", person: "dada", doctor: "Dr Iyer", doctorKey: "doc-iyer", day: -30, time: "08:20", status: "completed", clinic: "Fictional Lab Desk", purpose: "Laboratory test (demo)" },
    { seedKey: "apt-dada-den-past", person: "dada", doctor: "Dr Rao", doctorKey: "doc-rao", day: -44, time: "13:30", status: "completed", clinic: "Fictional Dental Studio", purpose: "Dental check-up (demo)" },
    { seedKey: "apt-papa-cancel", person: "papa", doctor: "Dr Nair", doctorKey: "doc-nair", day: 7, time: "17:00", status: "cancelled", clinic: "Fictional Eye Desk", purpose: "Cancelled demo visit" },
  ];

  const docKinds = [
    ["prescription", "prescription", "Prescription"],
    ["report", "bp-report", "BP monitoring summary"],
    ["report", "glucose-report", "Glucose monitoring summary"],
    ["report", "lab", "Blood-test report"],
    ["note", "consult", "Consultation summary"],
    ["report", "discharge", "Discharge-summary example"],
    ["other", "vaccine", "Vaccination record"],
    ["report", "lab-follow", "Laboratory follow-up report"],
  ] as const;

  const documents = DEMO_PEOPLE.flatMap((p, pi) =>
    docKinds.slice(0, 6).map((k, i) => ({
      seedKey: `doc-${p.key}-${k[1]}`,
      person: p.key,
      name: `${k[2]} — ${p.name} (demo)`,
      type: k[0] as "report" | "prescription" | "note" | "other",
      category: k[1],
      date: addDays(referenceDate, -6 - i * 8 - pi),
      preview: `DEMO PREVIEW — FICTIONAL — NOT FOR CLINICAL USE.\nRecipient: ${p.name} (fictional)\nDocument: ${k[2]}\nSample extraction fixture only. This text was not produced by OCR.`,
    })),
  );

  const history = [
    { seedKey: "hx-mummy-glu", person: "mummy" as const, category: "chronic" as const, name: "Glucose monitoring (demo)", notes: "Fictional family note about home glucose checks." },
    { seedKey: "hx-mummy-bp", person: "mummy" as const, category: "chronic" as const, name: "Blood-pressure monitoring (demo)", notes: "Fictional BP log habit." },
    { seedKey: "hx-mummy-all", person: "mummy" as const, category: "illness" as const, name: "Sulfa sensitivity (demo)", notes: "Fictional allergy example. Not a real record." },
    { seedKey: "hx-papa-bp", person: "papa" as const, category: "chronic" as const, name: "Blood-pressure monitoring (demo)", notes: "Fictional cardiology follow context." },
    { seedKey: "hx-papa-card", person: "papa" as const, category: "illness" as const, name: "Cardiology consultation summary (demo)", notes: "Fictional consult note. Not a diagnosis." },
    { seedKey: "hx-papa-all", person: "papa" as const, category: "illness" as const, name: "Dust sensitivity (demo)", notes: "Fictional allergy example." },
    { seedKey: "hx-dadi-ortho", person: "dadi" as const, category: "chronic" as const, name: "Mobility / orthopedic history (demo)", notes: "Fictional joint clinic note." },
    { seedKey: "hx-dadi-all", person: "dadi" as const, category: "illness" as const, name: "Penicillin family note (demo)", notes: "Fictional allergy example." },
    { seedKey: "hx-dadi-ill", person: "dadi" as const, category: "illness" as const, name: "Previous illness (demo)", notes: "Fictional recovered entry." },
    { seedKey: "hx-dada-gen", person: "dada" as const, category: "family_history" as const, name: "General medical-history note (demo)", notes: "Fictional annual checkup context." },
    { seedKey: "hx-dada-hosp", person: "dada" as const, category: "hospitalization" as const, name: "Monitoring admission (demo)", notes: "Fictional short stay — sample only." },
    { seedKey: "hx-dada-all", person: "dada" as const, category: "illness" as const, name: "Seafood sensitivity (demo)", notes: "Fictional allergy example." },
  ];

  const vaccinations = DEMO_PEOPLE.flatMap((p) => [
    { seedKey: `vac-${p.key}-flu`, person: p.key, name: "Influenza (demo fixture)", dose: "Annual", received: addDays(referenceDate, -40), next: addDays(referenceDate, 325) },
    { seedKey: `vac-${p.key}-covid`, person: p.key, name: "COVID-19 booster (demo fixture)", dose: "Booster", received: addDays(referenceDate, -180), next: addDays(referenceDate, 185) },
    { seedKey: `vac-${p.key}-td`, person: p.key, name: "Tetanus (demo fixture)", dose: "Td", received: addDays(referenceDate, -400), next: addDays(referenceDate, 330) },
  ]);

  const diary = DEMO_PEOPLE.flatMap((p) => [
    { seedKey: `diary-${p.key}-1`, person: p.key, title: "Home measurement note (demo)", body: `Family-entered demo diary for ${p.name}. Not a clinician statement.`, day: -2 },
    { seedKey: `diary-${p.key}-2`, person: p.key, title: "Medicine schedule reviewed (demo)", body: "Morning medicines checked. Fictional family note.", day: -5 },
    { seedKey: `diary-${p.key}-3`, person: p.key, title: "Report reviewed (demo)", body: "Looked at the latest fictional blood-test summary.", day: -9 },
    { seedKey: `diary-${p.key}-4`, person: p.key, title: "Follow-up prep (demo)", body: "Questions written for the next fictional clinic visit.", day: -14 },
  ]);

  const measurements = DEMO_PEOPLE.flatMap((p) => specifiedMeasurements(p.key, referenceDate));

  return {
    version: DEMO_SEED_VERSION,
    referenceDate,
    created,
    people,
    doctors,
    medicines: medicines.map((m) => ({
      ...m,
      start: addDays(referenceDate, m.endOffset ? m.endOffset - 120 : -200),
      end: m.endOffset ? addDays(referenceDate, m.endOffset) : undefined,
      notes: `${DEMO_RECORD_LABEL}. Fictional dose fixture — not a prescription.`,
    })),
    refills: refills.map((r) => ({ ...r, planned: addDays(referenceDate, r.days) })),
    reminders,
    appointments: appointmentSpecs.map((a) => ({
      ...a,
      date: addDays(referenceDate, a.day),
      followUpDate: a.follow ? addDays(referenceDate, a.day + a.follow) : undefined,
    })),
    documents,
    history,
    vaccinations,
    diary,
    measurements,
    memory: [
      ...appointmentSpecs.slice(0, 4).map((a) => ({ seedKey: `mem-${a.seedKey}`, person: a.person, title: `${a.doctor} appointment scheduled (demo)`, at: created })),
      ...documents.slice(0, 4).map((d) => ({ seedKey: `mem-${d.seedKey}`, person: d.person, title: `${d.name} added`, at: stamp(d.date, "12:00") })),
    ],
  };
}

export type DemoDataset = ReturnType<typeof buildDemoDataset>;

export function datasetCounts(ds: DemoDataset) {
  return {
    version: ds.version,
    people: ds.people.length,
    doctors: ds.doctors.length,
    medicines: ds.medicines.length,
    refills: ds.refills.length,
    reminders: ds.reminders.length,
    appointments: ds.appointments.length,
    documents: ds.documents.length,
    history: ds.history.length,
    vaccinations: ds.vaccinations.length,
    diary: ds.diary.length,
    measurements: ds.measurements.length,
    memory: ds.memory.length,
    bpPerMember: 10,
    glucosePerMember: 10,
  };
}

function tone(key: DemoPersonKey): FamilyMember["avatar"]["tone"] {
  return key === "mummy" ? "peach" : key === "papa" ? "terracotta" : key === "dadi" ? "sand" : "brown";
}

function emptyShell(ds: DemoDataset): AppState {
  return {
    version: 9,
    onboarded: true,
    user: { name: "Demo host" },
    family: [],
    reminders: [],
    medicines: [],
    refills: [],
    appointments: [],
    doctors: [],
    documents: [],
    measurements: [],
    medicalHistory: [],
    vaccinations: [],
    diary: [],
    memory: [],
    conversations: [],
    inAppNotifications: [],
    settings: {
      language: "en",
      reminderLanguage: "hinglish",
      reminderSound: "Gentle",
      wisprEnabled: true,
      notifications: true,
      familyUpdates: true,
      reducedMotion: false,
      compactDensity: true,
      memberColors: {},
      demoWorkspace: true,
    },
    demoNow: stamp(ds.referenceDate, "10:30"),
    selectedDate: ds.referenceDate,
  };
}

export function datasetAsAppState(ds: DemoDataset): AppState {
  const empty = emptyShell(ds);
  const family: FamilyMember[] = ds.people.map((p) => ({
    id: p.key,
    name: p.name,
    relationship: p.relationship as FamilyMember["relationship"],
    age: p.age,
    avatar: { initials: p.name.charAt(0), tone: tone(p.key) },
    createdAt: ds.created,
    colorKey: p.colorKey,
  }));
  const doctors: FamilyDoctor[] = ds.doctors.map((d) => ({
    id: d.seedKey,
    name: d.name,
    specialty: d.specialty,
    category: d.category,
    clinic: d.clinic,
    documentIds: [],
    recipientIds: family.map((m) => m.id),
    archived: false,
    createdAt: ds.created,
    source: "sample",
  }));
  const medicines: Medicine[] = ds.medicines.map((m) => ({
    id: m.seedKey,
    familyMemberId: m.person,
    name: m.name,
    strength: m.strength,
    dosage: m.dosage,
    frequency: m.frequency,
    times: m.times,
    startDate: m.start,
    endDate: m.end,
    ongoing: m.ongoing,
    status: m.status,
    prescriber: m.prescriber,
    source: "other",
    notes: m.notes,
    reminderSetup: "scheduled",
    createdAt: ds.created,
    updatedAt: ds.created,
    changeHistory: [],
  }));
  const refills: MedicineRefill[] = ds.refills.map((r) => ({
    id: r.seedKey,
    medicineId: r.medicine,
    familyMemberId: r.person,
    remainingQuantity: r.remaining,
    unit: r.unit,
    unitsPerDose: r.perDose,
    plannedDate: r.planned,
    reminderDate: r.planned,
    reminderTime: "18:00",
    status: "upcoming",
    notes: `${DEMO_RECORD_LABEL}. Fictional stock.`,
    createdAt: ds.created,
    updatedAt: ds.created,
  }));
  const reminders: Reminder[] = ds.reminders.map((r) => ({
    id: r.seedKey,
    familyMemberId: r.person,
    title: r.title,
    kind: r.kind,
    time: r.time,
    frequency: r.recurrence === "once" ? "once" : r.recurrence === "weekly" ? "weekly" : "daily",
    date: r.date,
    status: "active",
    createdAt: ds.created,
    source: "sample",
    confirmationHistory:
      "done" in r && r.done
        ? [{ id: `${r.seedKey}-c0`, date: ds.referenceDate, confirmedAt: stamp(ds.referenceDate, r.time), response: "Done (demo)", source: "manual" as const }]
        : [],
    medicineId: r.medicine,
    reminderRole: r.role,
  }));
  const appointments: Appointment[] = ds.appointments.map((a) => ({
    id: a.seedKey,
    familyMemberId: a.person,
    doctor: a.doctor,
    doctorId: a.doctorKey,
    clinic: a.clinic,
    date: a.date,
    time: a.time,
    location: a.clinic,
    purpose: a.purpose,
    notes: `${DEMO_RECORD_LABEL}. Not an external booking.`,
    documentIds: [],
    reminders: [{ id: `${a.seedKey}-prep`, label: "Day-before reminder (demo)", offsetMinutes: 24 * 60, enabled: true }],
    status: a.status,
    createdAt: ds.created,
    source: "sample",
    followUpDate: a.followUpDate,
  }));
  const documents: HealthDocument[] = ds.documents.map((d) => ({
    id: d.seedKey,
    familyMemberId: d.person,
    name: d.name,
    type: d.type,
    date: d.date,
    file: { name: `${d.seedKey}.txt`, size: d.preview.length, mime: "text/plain", storage: "sample" },
    metadata: {
      source: "sample",
      detectedFrom: "sample",
      description: d.preview,
      extractStatus: "needs_review",
      extractProvider: "demo",
    },
    addedAt: stamp(d.date, "12:00"),
  }));
  const measurements: HealthMeasurement[] = ds.measurements.map((m) => ({
    id: m.seedKey,
    familyMemberId: m.person,
    kind: m.kind,
    value: m.value,
    unit: m.unit,
    systolic: m.systolic,
    diastolic: m.diastolic,
    glucoseContext: m.glucoseContext,
    recordedAt: m.recordedAt,
    source: "sample",
    note: m.note,
    confirmation: "family_reported",
  }));
  const medicalHistory: MedicalHistoryEntry[] = ds.history.map((h) => ({
    id: h.seedKey,
    familyMemberId: h.person,
    category: h.category,
    name: h.name,
    notes: h.notes,
    source: "sample",
    createdAt: ds.created,
    updatedAt: ds.created,
  }));
  const vaccinations: Vaccination[] = ds.vaccinations.map((v) => ({
    id: v.seedKey,
    familyMemberId: v.person,
    name: v.name,
    dose: v.dose,
    receivedDate: v.received,
    nextDueDate: v.next,
    notes: `${DEMO_RECORD_LABEL}. Not a schedule recommendation.`,
    source: "sample",
    createdAt: ds.created,
  }));
  const diary: DiaryEntry[] = ds.diary.map((n) => ({
    id: n.seedKey,
    familyMemberId: n.person,
    title: n.title,
    body: n.body,
    recordedAt: stamp(addDays(ds.referenceDate, n.day), "20:00"),
    source: "sample",
    createdAt: ds.created,
  }));
  const memory: MemoryEvent[] = ds.memory.map((m) => ({
    id: m.seedKey,
    familyMemberId: m.person,
    type: "document_added",
    title: m.title,
    timestamp: m.at,
    source: "sample",
  }));

  return {
    ...empty,
    onboarded: true,
    user: { name: "Demo host" },
    family,
    reminders,
    medicines,
    refills,
    appointments,
    doctors,
    documents,
    measurements,
    medicalHistory,
    vaccinations,
    diary,
    memory,
    settings: {
      ...empty.settings,
      notifications: true,
      familyUpdates: true,
      demoWorkspace: true,
      memberColors: { mummy: "mummy", papa: "papa", dadi: "dadi", dada: "clay" },
    },
    demoNow: stamp(ds.referenceDate, "10:30"),
    selectedDate: ds.referenceDate,
  };
}

/** Used by Ask tests that only need a retrieval snapshot. */
export function datasetAsAskState(ds: DemoDataset) {
  return datasetAsAppState(ds);
}

export function latestPersisted(kind: "blood_pressure" | "blood_sugar", person: DemoPersonKey, referenceDate: string) {
  const rows = specifiedMeasurements(person, referenceDate).filter((r) => r.kind === kind);
  return rows[rows.length - 1];
}

export function sameWeekDate(a: string, b: string) {
  return dateOf(a) === dateOf(b);
}
