import type { Appointment, FamilyDoctor, FamilyMember } from "../types";
import { appointmentLists, listOnDate } from "../appointment-model";

export const SAMPLE_APPOINTMENT_BADGE = "Sample data — not real appointments";
export const SAMPLE_PREVIEW_LABEL = "Sample preview";
export const SAMPLE_REFERENCE_DATE = "2026-10-25";
export const SAMPLE_REFERENCE_HEADING = "Sunday, 25 October 2026";

const none: Appointment["reminders"] = [];

function row(
  partial: Omit<Appointment, "documentIds" | "reminders" | "createdAt" | "source"> & {
    displayStatus?: SampleChip;
  },
): FixtureAppointment {
  return {
    documentIds: [],
    reminders: none,
    createdAt: "2026-09-01T09:00",
    source: "sample",
    ...partial,
  };
}

export type SampleChip = "Upcoming" | "Confirmed" | "Follow-up" | "Completed";

export interface FixtureAppointment extends Appointment {
  displayStatus?: SampleChip;
}

export const SAMPLE_FAMILY: FamilyMember[] = [
  { id: "mummy", name: "Mummy", relationship: "Mother", avatar: { initials: "M", tone: "peach" }, createdAt: "2026-09-01T09:00" },
  { id: "papa", name: "Papa", relationship: "Father", avatar: { initials: "P", tone: "terracotta" }, createdAt: "2026-09-01T09:00" },
  { id: "dadi", name: "Dadi", relationship: "Grandmother", avatar: { initials: "D", tone: "brown" }, createdAt: "2026-09-01T09:00" },
];

export const SAMPLE_DOCTORS: FamilyDoctor[] = [
  { id: "fixture-doc-sharma", name: "Dr Sharma", specialty: "General Physician", category: "primary", clinic: "City Care Hospital", documentIds: [], recipientIds: ["mummy", "papa"], archived: false, createdAt: "2026-09-01T09:00", source: "sample" },
  { id: "fixture-doc-mehta", name: "Dr Mehta", specialty: "Cardiologist", category: "specialist", clinic: "Heart & Care Clinic", documentIds: [], recipientIds: ["papa"], archived: false, createdAt: "2026-09-01T09:00", source: "sample" },
  { id: "fixture-doc-kapoor", name: "Dr Kapoor", specialty: "Orthopedics", category: "specialist", clinic: "Joint Care Centre", documentIds: [], recipientIds: ["dadi"], archived: false, createdAt: "2026-09-01T09:00", source: "sample" },
];

/** Deterministic fictional appointments. IDs stay in the fixture-* namespace. */
export const SAMPLE_APPOINTMENTS: FixtureAppointment[] = [
  row({ id: "fixture-oct25-sharma", familyMemberId: "mummy", doctor: "Dr Sharma", specialty: "General Physician", clinic: "City Care Hospital", location: "City Care Hospital", date: "2026-10-25", time: "09:00", status: "upcoming", displayStatus: "Upcoming" }),
  row({ id: "fixture-oct25-mehta", familyMemberId: "papa", doctor: "Dr Mehta", specialty: "Cardiologist", clinic: "Heart & Care Clinic", location: "Heart & Care Clinic", date: "2026-10-25", time: "11:30", status: "upcoming", displayStatus: "Confirmed" }),
  row({
    id: "fixture-oct25-follow",
    familyMemberId: "mummy",
    doctor: "Follow-up Visit",
    specialty: "Diabetologist",
    clinic: "Sunrise Hospital",
    location: "Sunrise Hospital",
    date: "2026-10-25",
    time: "15:00",
    status: "upcoming",
    followUpOfId: "fixture-oct02-follow",
    displayStatus: "Follow-up",
  }),
  row({ id: "fixture-oct26-sharma", familyMemberId: "papa", doctor: "Dr Sharma", specialty: "General Physician", clinic: "City Care Hospital", date: "2026-10-26", time: "11:00", status: "upcoming", displayStatus: "Upcoming" }),
  row({ id: "fixture-oct28-kapoor", familyMemberId: "dadi", doctor: "Dr Kapoor", specialty: "Orthopedics", clinic: "Joint Care Centre", date: "2026-10-28", time: "16:00", status: "upcoming", displayStatus: "Upcoming" }),
  row({ id: "fixture-oct30-sharma", familyMemberId: "mummy", doctor: "Dr Sharma", specialty: "General Physician", clinic: "City Care Hospital", date: "2026-10-30", time: "11:00", status: "upcoming", displayStatus: "Upcoming" }),
  row({ id: "fixture-nov02-eye", familyMemberId: "papa", doctor: "Eye Checkup", specialty: "Ophthalmology", clinic: "Vision Centre", date: "2026-11-02", time: "15:00", status: "upcoming", displayStatus: "Upcoming" }),
  row({
    id: "fixture-oct15-gp",
    familyMemberId: "mummy",
    doctor: "General Physician Visit",
    specialty: "General Physician",
    clinic: "City Care Hospital",
    date: "2026-10-15",
    time: "10:00",
    status: "completed",
    visit: { actualDate: "2026-10-15", familyNotes: "Fictional family note for the demo only.", recordedAt: "2026-10-15T11:00" },
    displayStatus: "Completed",
  }),
  row({
    id: "fixture-oct10-cardio",
    familyMemberId: "papa",
    doctor: "Cardiology Checkup",
    specialty: "Cardiologist",
    clinic: "Heart & Care Clinic",
    date: "2026-10-10",
    time: "11:30",
    status: "completed",
    visit: { actualDate: "2026-10-10", familyNotes: "Fictional demo visit.", recordedAt: "2026-10-10T12:00" },
    displayStatus: "Completed",
  }),
  row({
    id: "fixture-oct02-follow",
    familyMemberId: "mummy",
    doctor: "Follow-up Visit",
    specialty: "Diabetologist",
    clinic: "Sunrise Hospital",
    date: "2026-10-02",
    time: "09:30",
    status: "completed",
    followUpDate: "2026-10-25",
    visit: { actualDate: "2026-10-02", followUpRecommended: true, followUpDate: "2026-10-25", familyNotes: "Fictional demo follow-up source.", recordedAt: "2026-10-02T10:00" },
    displayStatus: "Completed",
  }),
  row({
    id: "fixture-sep28-ortho",
    familyMemberId: "dadi",
    doctor: "Orthopedic Consultation",
    specialty: "Orthopedics",
    clinic: "Joint Care Centre",
    date: "2026-09-28",
    time: "16:00",
    status: "completed",
    visit: { actualDate: "2026-09-28", familyNotes: "Fictional demo consultation.", recordedAt: "2026-09-28T16:40" },
    displayStatus: "Completed",
  }),
];

export function sampleLists() {
  return appointmentLists(SAMPLE_APPOINTMENTS, SAMPLE_REFERENCE_DATE);
}

export function sampleOnDate(date: string) {
  return listOnDate(SAMPLE_APPOINTMENTS, date);
}

export function sampleMember(id: string): FamilyMember | undefined {
  return SAMPLE_FAMILY.find((m) => m.id === id);
}

export function fixturesNeverWriteVault(): { writesAppointments: false; writesReminders: false; writesSupabase: false } {
  return { writesAppointments: false, writesReminders: false, writesSupabase: false };
}

export function isFixtureId(id: string): boolean {
  return id.startsWith("fixture-");
}

export function hasLiveAppointments(items: Appointment[]): boolean {
  return items.some((a) => a.source !== "sample" && !isFixtureId(a.id));
}

export function sampleChip(a: FixtureAppointment): SampleChip {
  return a.displayStatus ?? (a.status === "completed" ? "Completed" : a.followUpOfId ? "Follow-up" : "Upcoming");
}
