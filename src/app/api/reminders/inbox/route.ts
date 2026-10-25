import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthedFamily, VaultError } from "@/lib/server/vault";
import { loadFamilyInbox } from "@/lib/server/in-app-processor";
import { DEFAULT_SNOOZE_MINUTES } from "@/lib/in-app-reminders";
import { FAMILY_TIMEZONE } from "@/lib/timezone";

export async function GET() {
  try {
    const { familyId } = await requireAuthedFamily();
    const items = await loadFamilyInbox(familyId);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message, items: [] }, { status: e.status });
    return NextResponse.json({ error: "Could not load inbox.", items: [] }, { status: 500 });
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["read", "acknowledge", "snooze", "skip", "complete", "taken"]),
});

export async function PATCH(req: Request) {
  try {
    const { supabase, userId } = await requireAuthedFamily();
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid inbox action." }, { status: 400 });

    const { data: row, error: loadErr } = await supabase.from("in_app_notifications").select("*").eq("id", parsed.data.id).maybeSingle();
    if (loadErr || !row) return NextResponse.json({ error: "Notification not found." }, { status: 404 });

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { actor_id: userId, actor_at: now };

    if (parsed.data.action === "read") {
      patch.unread = false;
    } else if (parsed.data.action === "acknowledge") {
      patch.status = "acknowledged";
      patch.unread = false;
    } else if (parsed.data.action === "snooze") {
      patch.status = "snoozed";
      patch.unread = false;
      patch.snooze_until = new Date(Date.now() + DEFAULT_SNOOZE_MINUTES * 60_000).toISOString();
    } else if (parsed.data.action === "skip") {
      patch.status = "skipped";
      patch.unread = false;
      if (row.dose_outcome === "none") patch.dose_outcome = "skipped";
    } else if (parsed.data.action === "complete") {
      patch.status = "completed";
      patch.unread = false;
    } else if (parsed.data.action === "taken") {
      patch.dose_outcome = "taken";
      patch.unread = false;
    }

    const { error } = await supabase.from("in_app_notifications").update(patch).eq("id", parsed.data.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (parsed.data.action === "skip" || parsed.data.action === "complete" || parsed.data.action === "snooze") {
      const occStatus = parsed.data.action === "snooze" ? "snoozed" : parsed.data.action === "skip" ? "skipped" : "completed";
      await supabase.from("reminder_occurrences").update({ status: occStatus, actor_id: userId, recorded_at: now }).eq("id", row.occurrence_id);
    }

    return NextResponse.json({ ok: true, snoozeUntil: patch.snooze_until ?? null, timezone: FAMILY_TIMEZONE });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Inbox update failed." }, { status: 500 });
  }
}
