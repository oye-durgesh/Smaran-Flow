import { addDays, dateOf, stamp } from "@/lib/dates";
import { DEMO_RECORD_LABEL, DEMO_SEED_VERSION } from "./workspace";

export const DEMO_PEOPLE = [
  { key: "mummy", name: "Mummy", relationship: "Mother", age: 58, colorKey: "mummy" },
  { key: "papa", name: "Papa", relationship: "Father", age: 62, colorKey: "papa" },
  { key: "dadi", name: "Dadi", relationship: "Grandmother", age: 78, colorKey: "dadi" },
  { key: "dada", name: "Dada Ji", relationship: "Grandfather", age: 82, colorKey: "clay" },
] as const;

export type DemoPersonKey = (typeof DEMO_PEOPLE)[number]["key"];

const OFFSET: Record<DemoPersonKey, { sys: number; dia: number; glu: number }> = {
  mummy: { sys: 0, dia: 0, glu: 2 },
  papa: { sys: 8, dia: 4, glu: 6 },
  dadi: { sys: 12, dia: 6, glu: 4 },
  dada: { sys: 10, dia: 5, glu: 1 },
};

/** Weekly Sunday 09:00 readings for 52 weeks ending on referenceDate. Gaps are never invented later. */
export function weeklyMeasurements(person: DemoPersonKey, referenceDate: string) {
  const rows: {
    seedKey: string;
    person: DemoPersonKey;
    kind: "blood_pressure" | "blood_sugar";
    value: string;
    unit: string;
    systolic?: number;
    diastolic?: number;
    glucoseContext?: "fasting";
    recordedAt: string;
    note: string;
  }[] = [];
  for (let w = 0; w < 52; w++) {
    const date = addDays(referenceDate, -7 * (51 - w));
    const off = OFFSET[person];
    const sys = 118 + off.sys + (w % 5);
    const dia = 76 + off.dia + (w % 3);
    const glu = 98 + off.glu + (w % 7);
    rows.push({
      seedKey: `meas-${person}-bp-${date}`,
      person,
      kind: "blood_pressure",
      value: `${sys}/${dia}`,
      unit: "mmHg",
      systolic: sys,
      diastolic: dia,
      recordedAt: stamp(date, "09:00"),
      note: `${DEMO_RECORD_LABEL}. Fictional weekly BP.`,
    });
    rows.push({
      seedKey: `meas-${person}-glu-${date}`,
      person,
      kind: "blood_sugar",
      value: String(glu),
      unit: "mg/dL",
      glucoseContext: "fasting",
      recordedAt: stamp(date, "07:45"),
      note: `${DEMO_RECORD_LABEL}. Fictional weekly glucose. Units retained as recorded.`,
    });
  }
  return rows;
}

export function buildDemoDataset(referenceDate: string) {
  const created = stamp(addDays(referenceDate, -40), "09:00");
  const people = DEMO_PEOPLE.map((p) => ({ ...p, seedKey: `person-${p.key}` }));

  const doctors = [
    { seedKey: "doc-sharma", name: "Dr Sharma", category: "primary" as const, specialty: "General Physician", clinic: "Fictional City Clinic" },
    { seedKey: "doc-mehta", name: "Dr Mehta", category: "specialist" as const, specialty: "Cardiology", clinic: "Fictional Heart Centre" },
    { seedKey: "doc-kapoor", name: "Dr Kapoor", category: "specialist" as const, specialty: "Endocrinology", clinic: "Fictional Sugar Clinic" },
    { seedKey: "doc-verma", name: "Dr Verma", category: "specialist" as const, specialty: "Orthopedics", clinic: "Fictional Joint Clinic" },
    { seedKey: "doc-nair", name: "Dr Nair", category: "specialist" as const, specialty: "General / eye-care fixture", clinic: "Fictional Eye Desk" },
  ];

  const medicines = [
    { seedKey: "med-mummy-met", person: "mummy" as const, name: "Metformin", strength: "500 mg", dosage: "1 tablet", times: ["08:00", "20:00"], frequency: "twice_daily" as const, status: "active" as const, ongoing: true },
    { seedKey: "med-mummy-tel", person: "mummy" as const, name: "Telmisartan", strength: "40 mg", dosage: "1 tablet", times: ["21:00"], frequency: "daily" as const, status: "active" as const, ongoing: true },
    { seedKey: "med-mummy-d3", person: "mummy" as const, name: "Vitamin D3", strength: "60k IU", dosage: "1 capsule weekly", times: ["10:00"], frequency: "weekly" as const, status: "paused" as const, ongoing: false },
    { seedKey: "med-papa-aml", person: "papa" as const, name: "Amlodipine", strength: "5 mg", dosage: "1 tablet", times: ["08:30"], frequency: "daily" as const, status: "active" as const, ongoing: true },
    { seedKey: "med-papa-ator", person: "papa" as const, name: "Atorvastatin", strength: "10 mg", dosage: "1 tablet", times: ["21:30"], frequency: "daily" as const, status: "active" as const, ongoing: true },
    { seedKey: "med-papa-old", person: "papa" as const, name: "Losartan", strength: "25 mg", dosage: "1 tablet", times: ["09:00"], frequency: "daily" as const, status: "stopped" as const, ongoing: false, endOffset: -90 },
    { seedKey: "med-dadi-levo", person: "dadi" as const, name: "Levothyroxine", strength: "50 mcg", dosage: "1 tablet", times: ["07:00"], frequency: "daily" as const, status: "active" as const, ongoing: true },
    { seedKey: "med-dadi-cal", person: "dadi" as const, name: "Calcium", strength: "500 mg", dosage: "1 tablet", times: ["21:00"], frequency: "daily" as const, status: "active" as const, ongoing: true },
    { seedKey: "med-dada-aml", person: "dada" as const, name: "Amlodipine", strength: "2.5 mg", dosage: "1 tablet", times: ["08:00"], frequency: "daily" as const, status: "active" as const, ongoing: true },
    { seedKey: "med-dada-done", person: "dada" as const, name: "Atorvastatin", strength: "10 mg", dosage: "1 tablet", times: ["21:00"], frequency: "daily" as const, status: "completed" as const, ongoing: false, endOffset: -20 },
  ];

  const refills = [
    { seedKey: "refill-mummy-met", medicine: "med-mummy-met", person: "mummy" as const, remaining: 8, unit: "tablets", perDose: 1, days: 3 },
    { seedKey: "refill-papa-aml", medicine: "med-papa-aml", person: "papa" as const, remaining: 12, unit: "tablets", perDose: 1, days: 6 },
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
        recurrence: "daily" as const,
        medicine: m.seedKey,
        role: "dose" as const,
        date: undefined as string | undefined,
      })),
    );
  const refillReminders = refills.map((r) => ({
    seedKey: `rem-${r.seedKey}`,
    person: r.person,
    title: `Refill ${r.medicine.replace("med-", "")}`,
    kind: "pickup" as const,
    time: "18:00",
    recurrence: "once" as const,
    medicine: r.medicine,
    role: "refill" as const,
    date: addDays(referenceDate, r.days) as string | undefined,
  }));
  const reminders = [...doseReminders, ...refillReminders];

  const appointments = [
    { seedKey: "apt-mummy-soon", person: "mummy" as const, doctor: "Dr Kapoor", doctorKey: "doc-kapoor", day: 4, time: "10:30", status: "upcoming" as const, clinic: "Fictional Sugar Clinic", purpose: "Glucose review (demo)" },
    { seedKey: "apt-papa-soon", person: "papa" as const, doctor: "Dr Mehta", doctorKey: "doc-mehta", day: 8, time: "15:00", status: "upcoming" as const, clinic: "Fictional Heart Centre", purpose: "BP follow-up (demo)" },
    { seedKey: "apt-dadi-soon", person: "dadi" as const, doctor: "Dr Verma", doctorKey: "doc-verma", day: 12, time: "11:00", status: "upcoming" as const, clinic: "Fictional Joint Clinic", purpose: "Mobility review (demo)" },
    { seedKey: "apt-dada-soon", person: "dada" as const, doctor: "Dr Sharma", doctorKey: "doc-sharma", day: 18, time: "09:30", status: "upcoming" as const, clinic: "Fictional City Clinic", purpose: "Annual checkup (demo)" },
    { seedKey: "apt-mummy-past", person: "mummy" as const, doctor: "Dr Sharma", doctorKey: "doc-sharma", day: -14, time: "10:00", status: "completed" as const, clinic: "Fictional City Clinic", purpose: "Clinic visit (demo)", follow: 21 },
    { seedKey: "apt-papa-past", person: "papa" as const, doctor: "Dr Mehta", doctorKey: "doc-mehta", day: -21, time: "16:00", status: "completed" as const, clinic: "Fictional Heart Centre", purpose: "Cardiology consult (demo)", follow: 30 },
    { seedKey: "apt-dadi-past", person: "dadi" as const, doctor: "Dr Verma", doctorKey: "doc-verma", day: -10, time: "12:00", status: "completed" as const, clinic: "Fictional Joint Clinic", purpose: "Orthopedic consult (demo)" },
    { seedKey: "apt-dada-past", person: "dada" as const, doctor: "Dr Sharma", doctorKey: "doc-sharma", day: -30, time: "09:00", status: "completed" as const, clinic: "Fictional City Clinic", purpose: "General history (demo)" },
    { seedKey: "apt-papa-cancel", person: "papa" as const, doctor: "Dr Nair", doctorKey: "doc-nair", day: 6, time: "17:00", status: "cancelled" as const, clinic: "Fictional Eye Desk", purpose: "Cancelled demo visit" },
  ];

  const docKinds = [
    ["prescription", "Prescription"],
    ["bp-report", "Blood-pressure report"],
    ["glucose-report", "Glucose / blood-test report"],
    ["lab", "Laboratory report"],
    ["imaging", "Imaging / scan"],
    ["consult", "Consultation note"],
    ["vaccine", "Vaccination record"],
    ["insurance", "Insurance / health document"],
  ] as const;

  const documents = DEMO_PEOPLE.flatMap((p, pi) =>
    docKinds.slice(0, 6).map((k, i) => ({
      seedKey: `doc-${p.key}-${k[0]}`,
      person: p.key,
      name: `${k[1]} — ${p.name} (demo)`,
      category: k[0],
      date: addDays(referenceDate, -5 - i * 9 - pi),
      preview: `DEMO PREVIEW — NOT A REAL PATIENT RECORD.\nRecipient: ${p.name} (fictional)\nDocument: ${k[1]}\nSample extraction fixture only. This is not OCR and not a stored private file.`,
    })),
  );

  const history = [
    { seedKey: "hx-mummy-glu", person: "mummy" as const, category: "chronic" as const, name: "Glucose monitoring (demo)", notes: "Fictional family note about home glucose checks." },
    { seedKey: "hx-mummy-bp", person: "mummy" as const, category: "chronic" as const, name: "Blood-pressure monitoring (demo)", notes: "Fictional BP log habit." },
    { seedKey: "hx-mummy-ill", person: "mummy" as const, category: "illness" as const, name: "Previous seasonal illness (demo)", notes: "Fictional recovered illness." },
    { seedKey: "hx-papa-bp", person: "papa" as const, category: "chronic" as const, name: "Blood-pressure monitoring (demo)", notes: "Fictional cardiology follow context." },
    { seedKey: "hx-papa-card", person: "papa" as const, category: "illness" as const, name: "Cardiology consultation summary (demo)", notes: "Fictional consult note. Not a diagnosis." },
    { seedKey: "hx-dadi-ortho", person: "dadi" as const, category: "chronic" as const, name: "Mobility / orthopedic history (demo)", notes: "Fictional joint clinic note." },
    { seedKey: "hx-dadi-ill", person: "dadi" as const, category: "illness" as const, name: "Previous illness (demo)", notes: "Fictional recovered entry." },
    { seedKey: "hx-dada-gen", person: "dada" as const, category: "family_history" as const, name: "General medical-history note (demo)", notes: "Fictional annual checkup context." },
    { seedKey: "hx-dada-hosp", person: "dada" as const, category: "hospitalization" as const, name: "Monitoring admission (demo)", notes: "Fictional short stay — sample only." },
  ];

  const vaccinations = DEMO_PEOPLE.map((p) => ({
    seedKey: `vac-${p.key}-flu`,
    person: p.key,
    name: "Influenza (demo fixture)",
    dose: "Annual",
    received: addDays(referenceDate, -40),
    next: addDays(referenceDate, 325),
  }));

  const diary = [
    { seedKey: "diary-mummy", person: "mummy" as const, title: "Home glucose note (demo)", body: "Family-entered demo diary. Not a verified clinician statement." },
    { seedKey: "diary-papa", person: "papa" as const, title: "Visit questions (demo)", body: "Ask Dr Mehta about last BP series. Demo only." },
    { seedKey: "diary-dadi", person: "dadi" as const, title: "Mobility observation (demo)", body: "Walked longer in the corridor. Family note." },
    { seedKey: "diary-dada", person: "dada" as const, title: "Annual checkup prep (demo)", body: "Bring last blood report to Dr Sharma. Demo only." },
  ];

  const measurements = DEMO_PEOPLE.flatMap((p) => weeklyMeasurements(p.key, referenceDate));

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
    appointments: appointments.map((a) => ({
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
      ...appointments.slice(0, 4).map((a) => ({ seedKey: `mem-${a.seedKey}`, person: a.person, title: `${a.doctor} appointment scheduled (demo)`, at: created })),
      ...documents.slice(0, 4).map((d) => ({ seedKey: `mem-${d.seedKey}`, person: d.person, title: `${d.name} added`, at: stamp(d.date, "12:00") })),
    ],
  };
}

export function datasetCounts(ds: ReturnType<typeof buildDemoDataset>) {
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
  };
}

export function datasetAsAskState(ds: ReturnType<typeof buildDemoDataset>) {
  const family = ds.people.map((p) => ({
    id: p.key,
    name: p.name,
    relationship: p.relationship as "Mother" | "Father" | "Grandmother" | "Grandfather",
    age: p.age,
    colorKey: p.colorKey,
    avatar: { initials: p.name.charAt(0), tone: "peach" as const },
    createdAt: ds.created,
  }));
  return {
    family,
    reminders: ds.reminders.map((r) => ({
      id: r.seedKey,
      familyMemberId: r.person,
      title: r.title,
      kind: r.kind,
      time: r.time,
      frequency: r.recurrence === "once" ? "once" : "daily",
      date: "date" in r ? (r as { date?: string }).date : undefined,
      status: "active" as const,
      createdAt: ds.created,
      source: "sample" as const,
      confirmationHistory: [],
      medicineId: r.medicine,
      reminderRole: r.role,
    })),
    appointments: ds.appointments.map((a) => ({
      id: a.seedKey,
      familyMemberId: a.person,
      doctor: a.doctor,
      date: a.date,
      time: a.time,
      clinic: a.clinic,
      status: a.status,
      documentIds: [],
      reminders: [],
      createdAt: ds.created,
      source: "sample" as const,
    })),
    documents: ds.documents.map((d) => ({
      id: d.seedKey,
      familyMemberId: d.person,
      name: d.name,
      type: "report" as const,
      date: d.date,
      file: { name: `${d.seedKey}.txt`, size: d.preview.length, mime: "text/plain", storage: "sample" as const },
      metadata: { source: "sample" as const, detectedFrom: "sample" as const, description: d.preview, extractStatus: "not_extracted" as const, extractProvider: "demo" as const },
      addedAt: stamp(d.date, "12:00"),
    })),
    measurements: ds.measurements.map((m) => ({
      id: m.seedKey,
      familyMemberId: m.person,
      kind: m.kind,
      value: m.value,
      unit: m.unit,
      systolic: m.systolic,
      diastolic: m.diastolic,
      glucoseContext: m.glucoseContext,
      recordedAt: m.recordedAt,
      source: "sample" as const,
      note: m.note,
      confirmation: "family_reported" as const,
    })),
    medicines: ds.medicines.map((m) => ({
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
      source: "other" as const,
      notes: m.notes,
      reminderSetup: "scheduled" as const,
      createdAt: ds.created,
      updatedAt: ds.created,
      changeHistory: [],
    })),
    medicalHistory: ds.history.map((h) => ({
      id: h.seedKey,
      familyMemberId: h.person,
      category: h.category,
      name: h.name,
      notes: h.notes,
      source: "sample" as const,
      createdAt: ds.created,
      updatedAt: ds.created,
    })),
    referenceDate: ds.referenceDate,
  };
}

export function latestPersisted(kind: "blood_pressure" | "blood_sugar", person: DemoPersonKey, referenceDate: string) {
  const rows = weeklyMeasurements(person, referenceDate).filter((r) => r.kind === kind);
  return rows[rows.length - 1];
}

export function sameWeekDate(a: string, b: string) {
  return dateOf(a) === dateOf(b);
}
