import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/nlu/ask";
import { askBodySchema } from "@/lib/interpret/zod";
import { rateLimit } from "@/lib/server/rate-limit";
import { readSession } from "@/lib/server/session";
import { loadAuthorizedFamily } from "@/lib/server/family-store";
import { VaultError } from "@/lib/server/vault";
import type { AppState } from "@/lib/types";

export const maxDuration = 30;

function snapshotState(evidence: NonNullable<ReturnType<typeof askBodySchema.parse>["evidence"]>): AppState {
  return {
    version: 5,
    onboarded: true,
    user: { name: "Family" },
    family: evidence.family.map((m) => ({
      id: m.id,
      name: m.name,
      relationship: (m.relationship as AppState["family"][number]["relationship"]) || "Other",
      avatar: { initials: m.name.charAt(0), tone: "peach" },
      createdAt: "",
    })),
    reminders: evidence.reminders.map((r) => ({
      id: r.id,
      familyMemberId: r.familyMemberId,
      title: r.title,
      kind: r.kind === "medicine" || r.kind === "check" || r.kind === "pickup" ? r.kind : "other",
      time: r.time,
      frequency: r.frequency === "weekly" || r.frequency === "once" ? r.frequency : "daily",
      status: "active",
      createdAt: "",
      source: "manual",
      confirmationHistory: [],
    })),
    appointments: evidence.appointments.map((a) => ({
      id: a.id,
      familyMemberId: a.familyMemberId,
      doctor: a.doctor,
      date: a.date,
      time: a.time,
      status: a.status === "completed" || a.status === "cancelled" ? a.status : "upcoming",
      documentIds: [],
      reminders: [],
      createdAt: "",
      source: "manual",
    })),
    documents: evidence.documents.map((d) => ({
      id: d.id,
      familyMemberId: d.familyMemberId,
      name: d.name,
      type: d.type === "report" || d.type === "prescription" || d.type === "scan" || d.type === "note" ? d.type : "other",
      date: d.date,
      file: { name: d.name, size: 0, mime: "application/pdf", storage: "local" },
      metadata: { source: "upload", detectedFrom: "manual" },
      addedAt: "",
    })),
    measurements: evidence.measurements.map((m) => ({
      id: m.id,
      familyMemberId: m.familyMemberId,
      kind: m.kind === "blood_pressure" || m.kind === "blood_sugar" || m.kind === "weight" || m.kind === "heart_rate" ? m.kind : "blood_pressure",
      value: m.value,
      unit: m.unit,
      recordedAt: m.recordedAt,
      systolic: "systolic" in m ? (m as { systolic?: number }).systolic : undefined,
      diastolic: "diastolic" in m ? (m as { diastolic?: number }).diastolic : undefined,
      glucoseContext: (m as { glucoseContext?: "fasting" | "post_meal" | "random" }).glucoseContext,
      source: "manual" as const,
    })),
    medicines: [],
    refills: [],
    doctors: [],
    medicalHistory: [],
    vaccinations: [],
    diary: [],
    memory: [],
    conversations: [],
    inAppNotifications: [],
    settings: { language: "en", reminderLanguage: "hinglish", reminderSound: "Gentle", wisprEnabled: true, notifications: false, familyUpdates: false, reducedMotion: false, compactDensity: true, memberColors: {} },
    demoNow: evidence.measurements[0]?.recordedAt ?? "2026-01-01T00:00",
    selectedDate: "2026-01-01",
  };
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`ask:${ip}`)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > 20_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "We could not read that request." }, { status: 400 });
  }
  const parsed = askBodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid question." }, { status: 400 });

  const session = await readSession();
  let authorized;
  try {
    authorized = await loadAuthorizedFamily(session);
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message, persistence: "supabase" }, { status: e.status });
    return NextResponse.json({ error: "Family vault read failed." }, { status: 500 });
  }
  const evidence = session.authenticated
    ? {
        family: authorized.family,
        appointments: authorized.appointments,
        reminders: authorized.reminders,
        measurements: authorized.measurements,
        documents: authorized.documents,
      }
    : session.mode === "device-local"
      ? parsed.data.evidence
      : undefined;

  if (!evidence) {
    return NextResponse.json({
      found: false,
      refs: [],
      text: "No matching record was found. Shared family retrieval is not configured; Ask is using this device only when you search from the app.",
      persistence: authorized.persistence,
      claudeUsed: false,
    });
  }

  const answer = answerQuestion(parsed.data.question, snapshotState(evidence), parsed.data.filterMemberId);
  return NextResponse.json({ ...answer, persistence: authorized.persistence, claudeUsed: false });
}
