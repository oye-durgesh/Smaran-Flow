import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthedFamily, VaultError } from "@/lib/server/vault";

const schema = z.object({
  recipientId: z.string().uuid(),
  kind: z.enum(["blood_pressure", "blood_sugar", "weight", "heart_rate"]),
  value: z.string().min(1).max(20),
  unit: z.string().max(16),
  sourceType: z.enum(["wispr", "manual", "document"]).default("manual"),
});

export async function POST(req: Request) {
  try {
    const { supabase, familyId, userId } = await requireAuthedFamily();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid measurement." }, { status: 400 });
    const { data, error } = await supabase
      .from("health_measurements")
      .insert({
        family_id: familyId,
        recipient_id: parsed.data.recipientId,
        kind: parsed.data.kind,
        value: parsed.data.value,
        unit: parsed.data.unit,
        recorded_at: new Date().toISOString(),
        author_id: userId,
        source_type: parsed.data.sourceType,
        confirmation_status: "family_reported",
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
