import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthedFamily, VaultError } from "@/lib/server/vault";

const schema = z.object({
  name: z.string().min(1).max(80),
  specialty: z.string().max(80).optional(),
  category: z.enum(["primary", "specialist"]),
  clinic: z.string().max(120).optional(),
  address: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  notes: z.string().max(400).optional(),
  recipientIds: z.array(z.string().uuid()).optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  archived: z.boolean().optional(),
  category: z.enum(["primary", "specialist"]).optional(),
  name: z.string().min(1).max(80).optional(),
  specialty: z.string().max(80).optional(),
  clinic: z.string().max(120).optional(),
  address: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  notes: z.string().max(400).optional(),
  recipientIds: z.array(z.string().uuid()).optional(),
});

export async function POST(req: Request) {
  try {
    const { supabase, familyId, userId } = await requireAuthedFamily();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid doctor details." }, { status: 400 });
    const { data: existing } = await supabase
      .from("family_doctors")
      .select("id, recipient_ids")
      .eq("family_id", familyId)
      .ilike("name", parsed.data.name.trim())
      .eq("archived", false)
      .maybeSingle();
    if (existing) {
      const recipientIds = [...new Set([...(existing.recipient_ids ?? []), ...(parsed.data.recipientIds ?? [])])];
      await supabase.from("family_doctors").update({ recipient_ids: recipientIds }).eq("id", existing.id).eq("family_id", familyId);
      return NextResponse.json({ ok: true, id: existing.id, reused: true });
    }
    const { data, error } = await supabase
      .from("family_doctors")
      .insert({
        family_id: familyId,
        name: parsed.data.name.trim(),
        specialty: parsed.data.specialty,
        category: parsed.data.category,
        clinic: parsed.data.clinic,
        address: parsed.data.address,
        phone: parsed.data.phone,
        notes: parsed.data.notes,
        recipient_ids: parsed.data.recipientIds ?? [],
        created_by: userId,
        is_sample: false,
      })
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || "Doctor save failed." }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, reused: false });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Doctor write failed." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, familyId } = await requireAuthedFamily();
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid doctor update." }, { status: 400 });
    const { id, ...rest } = parsed.data;
    const patch: Record<string, unknown> = {};
    if (rest.archived != null) patch.archived = rest.archived;
    if (rest.category) patch.category = rest.category;
    if (rest.name) patch.name = rest.name;
    if (rest.specialty !== undefined) patch.specialty = rest.specialty;
    if (rest.clinic !== undefined) patch.clinic = rest.clinic;
    if (rest.address !== undefined) patch.address = rest.address;
    if (rest.phone !== undefined) patch.phone = rest.phone;
    if (rest.notes !== undefined) patch.notes = rest.notes;
    if (rest.recipientIds) patch.recipient_ids = rest.recipientIds;
    const { data, error } = await supabase.from("family_doctors").update(patch).eq("id", id).eq("family_id", familyId).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Doctor not found for this family." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Doctor update failed." }, { status: 500 });
  }
}
