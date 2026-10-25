import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthedFamily, VaultError } from "@/lib/server/vault";

const historySchema = z.object({
  kind: z.literal("history"),
  recipientId: z.string().uuid(),
  category: z.enum(["illness", "chronic", "surgery", "hospitalization", "family_history"]),
  name: z.string().min(1).max(120),
  status: z.string().max(40).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  hospital: z.string().max(120).optional(),
  relationship: z.string().max(40).optional(),
  notes: z.string().max(400).optional(),
});

const vaccineSchema = z.object({
  kind: z.literal("vaccination"),
  recipientId: z.string().uuid(),
  name: z.string().min(1).max(80),
  dose: z.string().max(40).optional(),
  receivedDate: z.string().optional(),
  nextDueDate: z.string().optional(),
  clinic: z.string().max(120).optional(),
  notes: z.string().max(400).optional(),
});

const diarySchema = z.object({
  kind: z.literal("diary"),
  recipientId: z.string().uuid(),
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(2000),
});

const schema = z.discriminatedUnion("kind", [historySchema, vaccineSchema, diarySchema]);

export async function POST(req: Request) {
  try {
    const { supabase, familyId, userId } = await requireAuthedFamily();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid health-record details." }, { status: 400 });
    const { data: rec } = await supabase.from("care_recipients").select("id").eq("id", parsed.data.recipientId).eq("family_id", familyId).maybeSingle();
    if (!rec) return NextResponse.json({ error: "That person is not in this family." }, { status: 403 });

    if (parsed.data.kind === "history") {
      const { data, error } = await supabase
        .from("medical_history")
        .insert({
          family_id: familyId,
          recipient_id: parsed.data.recipientId,
          category: parsed.data.category,
          name: parsed.data.name,
          status: parsed.data.status,
          start_date: parsed.data.startDate || null,
          end_date: parsed.data.endDate || null,
          hospital: parsed.data.hospital,
          relationship: parsed.data.relationship,
          notes: parsed.data.notes,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error || !data) return NextResponse.json({ error: error?.message || "Save failed." }, { status: 500 });
      return NextResponse.json({ ok: true, id: data.id });
    }
    if (parsed.data.kind === "vaccination") {
      const { data, error } = await supabase
        .from("vaccinations")
        .insert({
          family_id: familyId,
          recipient_id: parsed.data.recipientId,
          name: parsed.data.name,
          dose: parsed.data.dose,
          received_date: parsed.data.receivedDate || null,
          next_due_date: parsed.data.nextDueDate || null,
          clinic: parsed.data.clinic,
          notes: parsed.data.notes,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error || !data) return NextResponse.json({ error: error?.message || "Save failed." }, { status: 500 });
      return NextResponse.json({ ok: true, id: data.id });
    }
    const { data, error } = await supabase
      .from("health_diary")
      .insert({
        family_id: familyId,
        recipient_id: parsed.data.recipientId,
        title: parsed.data.title,
        body: parsed.data.body,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || "Save failed." }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Health record write failed." }, { status: 500 });
  }
}
