import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthedFamily, VaultError } from "@/lib/server/vault";

const schema = z.object({
  recipientId: z.string().uuid(),
  title: z.string().min(1).max(80),
  kind: z.enum(["medicine", "check", "pickup", "other"]),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recurrence: z.enum(["once", "daily", "weekly"]),
  medicineName: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  try {
    const { supabase, familyId, userId } = await requireAuthedFamily();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid reminder." }, { status: 400 });
    const { data, error } = await supabase
      .from("reminders")
      .insert({
        family_id: familyId,
        recipient_id: parsed.data.recipientId,
        title: parsed.data.title,
        kind: parsed.data.kind,
        medicine_name: parsed.data.medicineName,
        local_time: parsed.data.time,
        local_date: parsed.data.date,
        timezone: "Asia/Kolkata",
        recurrence: parsed.data.recurrence,
        status: "active",
        created_by: userId,
        is_sample: false,
      })
      .select("id, created_at")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || "Create failed." }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, created_at: data.created_at, scheduled: true });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Reminder write failed." }, { status: 500 });
  }
}
