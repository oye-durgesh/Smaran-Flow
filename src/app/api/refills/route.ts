import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthedFamily, VaultError } from "@/lib/server/vault";

const schema = z.object({
  medicineId: z.string().uuid(),
  remainingQuantity: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  unitsPerDose: z.number().positive().optional(),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reminderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  notes: z.string().max(400).optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["upcoming", "due", "completed", "snoozed", "cancelled"]),
});

export async function POST(req: Request) {
  try {
    const { supabase, familyId, userId } = await requireAuthedFamily();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid refill reminder." }, { status: 400 });
    if (!parsed.data.plannedDate && !parsed.data.reminderDate) {
      return NextResponse.json({ error: "Set a planned or reminder date. Quantity is optional and will not be guessed." }, { status: 400 });
    }
    const { data: med, error: medErr } = await supabase.from("medicines").select("id, recipient_id, name").eq("id", parsed.data.medicineId).eq("family_id", familyId).maybeSingle();
    if (medErr) return NextResponse.json({ error: medErr.message }, { status: 500 });
    if (!med) return NextResponse.json({ error: "Medicine not found for this family." }, { status: 404 });

    const { data, error } = await supabase
      .from("medicine_refills")
      .insert({
        family_id: familyId,
        medicine_id: med.id,
        recipient_id: med.recipient_id,
        remaining_quantity: parsed.data.remainingQuantity ?? null,
        unit: parsed.data.unit,
        units_per_dose: parsed.data.unitsPerDose ?? null,
        planned_date: parsed.data.plannedDate,
        reminder_date: parsed.data.reminderDate ?? parsed.data.plannedDate,
        reminder_time: parsed.data.reminderTime ?? "09:00",
        status: "upcoming",
        notes: parsed.data.notes,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || "Refill save failed." }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Refill write failed." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, familyId } = await requireAuthedFamily();
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid refill update." }, { status: 400 });
    const { data, error } = await supabase
      .from("medicine_refills")
      .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.id)
      .eq("family_id", familyId)
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Refill not found for this family." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Refill update failed." }, { status: 500 });
  }
}
