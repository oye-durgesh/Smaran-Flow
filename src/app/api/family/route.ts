import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthedFamily, VaultError } from "@/lib/server/vault";

const schema = z.object({
  name: z.string().min(1).max(40),
  relationship: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  try {
    const { supabase, familyId, userId } = await requireAuthedFamily();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid family member." }, { status: 400 });
    const { data, error } = await supabase
      .from("care_recipients")
      .insert({
        family_id: familyId,
        display_name: parsed.data.name,
        relationship: parsed.data.relationship,
        created_by: userId,
      })
      .select("id, created_at")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || "Create failed." }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, created_at: data.created_at });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Family write failed." }, { status: 500 });
  }
}
