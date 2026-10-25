import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthedFamily, VaultError } from "@/lib/server/vault";
import { rateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  consent: z.literal("copy-device-records-to-my-family"),
  recipients: z.array(z.object({ name: z.string(), relationship: z.string().optional() })).max(10),
  appointments: z
    .array(z.object({ recipientName: z.string(), doctor: z.string(), date: z.string(), time: z.string() }))
    .max(40),
  reminders: z.array(z.object({ recipientName: z.string(), title: z.string(), kind: z.string(), time: z.string(), recurrence: z.string() })).max(40),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`migrate:${ip}`, 3, 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  try {
    const { supabase, familyId, userId } = await requireAuthedFamily();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Migration requires explicit consent and a valid payload." }, { status: 400 });
    const nameToId = new Map<string, string>();
    for (const r of parsed.data.recipients) {
      const { data, error } = await supabase
        .from("care_recipients")
        .insert({ family_id: familyId, display_name: r.name, relationship: r.relationship, created_by: userId })
        .select("id")
        .single();
      if (error || !data) return NextResponse.json({ error: error?.message || "Recipient copy failed." }, { status: 500 });
      nameToId.set(r.name, data.id);
    }
    for (const a of parsed.data.appointments) {
      const rid = nameToId.get(a.recipientName);
      if (!rid) continue;
      const { error } = await supabase.from("appointments").insert({
        family_id: familyId,
        recipient_id: rid,
        doctor: a.doctor,
        local_date: a.date,
        local_time: a.time,
        starts_at: `${a.date}T${a.time}:00+05:30`,
        timezone: "Asia/Kolkata",
        status: "upcoming",
        created_by: userId,
        is_sample: true,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    for (const r of parsed.data.reminders) {
      const rid = nameToId.get(r.recipientName);
      if (!rid) continue;
      const { error } = await supabase.from("reminders").insert({
        family_id: familyId,
        recipient_id: rid,
        title: r.title,
        kind: r.kind === "medicine" || r.kind === "check" || r.kind === "pickup" ? r.kind : "other",
        local_time: r.time,
        timezone: "Asia/Kolkata",
        recurrence: r.recurrence,
        created_by: userId,
        is_sample: true,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, copied: true, note: "Device records were copied as labeled sample imports. Local browser data was not deleted." });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Migration failed." }, { status: 500 });
  }
}
