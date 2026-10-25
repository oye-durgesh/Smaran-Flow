import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/nlu/ask";
import { askBodySchema } from "@/lib/interpret/zod";
import { snapshotFromVault } from "@/lib/ask-state";
import { rateLimit } from "@/lib/server/rate-limit";
import { readSession } from "@/lib/server/session";
import { loadAuthorizedFamily } from "@/lib/server/family-store";
import { VaultError } from "@/lib/server/vault";
import type { AppState, FamilyMember } from "@/lib/types";

export const maxDuration = 30;

function evidenceToState(evidence: NonNullable<ReturnType<typeof askBodySchema.parse>["evidence"]>): AppState {
  return snapshotFromVault({
    family: evidence.family.map(
      (m): FamilyMember => ({
        id: m.id,
        name: m.name,
        relationship: (m.relationship as FamilyMember["relationship"]) || "Other",
        avatar: { initials: m.name.charAt(0), tone: "peach" },
        createdAt: "",
      }),
    ),
    reminders: evidence.reminders.map((r) => ({
      id: r.id,
      familyMemberId: r.familyMemberId,
      title: r.title,
      kind: r.kind === "medicine" || r.kind === "check" || r.kind === "pickup" ? r.kind : "other",
      time: r.time,
      frequency: r.frequency === "weekly" || r.frequency === "once" ? r.frequency : "daily",
      date: r.date,
      status: "active",
      createdAt: "",
      source: "manual",
      confirmationHistory: [],
      reminderRole: r.reminderRole === "refill" || r.reminderRole === "dose" ? r.reminderRole : undefined,
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
      metadata: {
        source: "upload",
        detectedFrom: "manual",
        extractStatus: d.extractStatus === "confirmed" || d.extractStatus === "needs_review" || d.extractStatus === "failed" || d.extractStatus === "not_extracted" ? d.extractStatus : "not_extracted",
      },
      addedAt: "",
    })),
    measurements: evidence.measurements.map((m) => ({
      id: m.id,
      familyMemberId: m.familyMemberId,
      kind: m.kind === "blood_pressure" || m.kind === "blood_sugar" || m.kind === "weight" || m.kind === "heart_rate" ? m.kind : "blood_pressure",
      value: m.value,
      unit: m.unit,
      recordedAt: m.recordedAt,
      systolic: m.systolic,
      diastolic: m.diastolic,
      glucoseContext: m.glucoseContext === "fasting" || m.glucoseContext === "post_meal" || m.glucoseContext === "random" ? m.glucoseContext : undefined,
      source: "manual" as const,
    })),
    medicines: evidence.medicines ?? [],
    medicalHistory: evidence.medicalHistory ?? [],
    vaccinations: evidence.vaccinations ?? [],
    diary: evidence.diary ?? [],
    memory: evidence.memory ?? [],
    refills: evidence.refills ?? [],
  });
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

  const state = session.authenticated
    ? snapshotFromVault(authorized)
    : session.mode === "device-local" && parsed.data.evidence
      ? evidenceToState(parsed.data.evidence)
      : null;

  if (!state) {
    return NextResponse.json({
      found: false,
      refs: [],
      text: "No matching record was found. Shared family retrieval is not configured; Ask is using this device only when you search from the app.",
      persistence: authorized.persistence,
      claudeUsed: false,
    });
  }

  const answer = answerQuestion(parsed.data.question, state, parsed.data.filterMemberId);
  return NextResponse.json({ ...answer, persistence: authorized.persistence, claudeUsed: false });
}
