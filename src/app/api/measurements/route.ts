import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthedFamily, VaultError } from "@/lib/server/vault";
import { isImplausible } from "@/lib/health-record-model";

const schema = z.object({
  recipientId: z.string().uuid(),
  kind: z.enum(["blood_pressure", "blood_sugar", "weight", "heart_rate", "temperature", "spo2", "other"]),
  value: z.string().min(1).max(40),
  unit: z.string().max(16),
  systolic: z.number().optional(),
  diastolic: z.number().optional(),
  glucoseContext: z.enum(["fasting", "post_meal", "random"]).optional(),
  note: z.string().max(200).optional(),
  recordedAt: z.string().optional(),
  sourceType: z.enum(["wispr", "manual", "document"]).default("manual"),
});

export async function POST(req: Request) {
  try {
    const { supabase, familyId, userId } = await requireAuthedFamily();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid measurement." }, { status: 400 });
    const { data: rec } = await supabase.from("care_recipients").select("id").eq("id", parsed.data.recipientId).eq("family_id", familyId).maybeSingle();
    if (!rec) return NextResponse.json({ error: "That person is not in this family." }, { status: 403 });
    const warning = isImplausible(parsed.data.kind, parsed.data.value, parsed.data.unit, parsed.data.systolic, parsed.data.diastolic);
    const { data, error } = await supabase
      .from("health_measurements")
      .insert({
        family_id: familyId,
        recipient_id: parsed.data.recipientId,
        kind: parsed.data.kind,
        value: parsed.data.value,
        unit: parsed.data.unit,
        systolic: parsed.data.systolic,
        diastolic: parsed.data.diastolic,
        glucose_context: parsed.data.glucoseContext,
        note: parsed.data.note,
        recorded_at: parsed.data.recordedAt || new Date().toISOString(),
        author_id: userId,
        source_type: parsed.data.sourceType,
        confirmation_status: warning ? "needs_review" : "family_reported",
        is_sample: false,
      })
      .select("id, recorded_at")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || "Create failed." }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, recorded_at: data.recorded_at });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Measurement write failed." }, { status: 500 });
  }
}
