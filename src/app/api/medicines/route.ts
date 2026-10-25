import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthedFamily, VaultError } from "@/lib/server/vault";

const draftSchema = z.object({
  recipientId: z.string().uuid(),
  name: z.string().min(1).max(80),
  strength: z.string().max(40).optional(),
  dosage: z.string().max(40).optional(),
  route: z.string().max(40).optional(),
  frequency: z.enum(["daily", "twice_daily", "weekly", "as_needed", "custom"]),
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).max(8),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ongoing: z.boolean(),
  prescriber: z.string().max(80).optional(),
  instructions: z.string().max(400).optional(),
  source: z.enum(["prescription", "document", "manual", "other"]),
  documentId: z.string().uuid().optional(),
  notes: z.string().max(400).optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["update", "pause", "resume", "complete", "stop", "archive"]),
  draft: draftSchema.optional(),
});

export async function POST(req: Request) {
  try {
    const { supabase, familyId, userId } = await requireAuthedFamily();
    const parsed = draftSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Missing or invalid medicine details.", details: parsed.error.flatten() }, { status: 400 });

    const { data: recipient, error: recErr } = await supabase
      .from("care_recipients")
      .select("id")
      .eq("id", parsed.data.recipientId)
      .eq("family_id", familyId)
      .maybeSingle();
    if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 });
    if (!recipient) return NextResponse.json({ error: "That person is not in this family." }, { status: 403 });

    const reminderSetup = parsed.data.frequency === "as_needed" || parsed.data.times.length === 0 ? "needs_setup" : "scheduled";
    const { data, error } = await supabase
      .from("medicines")
      .insert({
        family_id: familyId,
        recipient_id: parsed.data.recipientId,
        name: parsed.data.name,
        strength: parsed.data.strength,
        dosage: parsed.data.dosage,
        route: parsed.data.route,
        frequency: parsed.data.frequency,
        times: parsed.data.times,
        start_date: parsed.data.startDate,
        end_date: parsed.data.ongoing ? null : parsed.data.endDate ?? null,
        ongoing: parsed.data.ongoing,
        status: "active",
        prescriber: parsed.data.prescriber,
        instructions: parsed.data.instructions,
        source: parsed.data.source,
        document_id: parsed.data.documentId,
        notes: parsed.data.notes,
        reminder_setup: reminderSetup,
        created_by: userId,
        is_sample: false,
      })
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || "Medicine save failed." }, { status: 500 });

    await supabase.from("medicine_changes").insert({
      medicine_id: data.id,
      family_id: familyId,
      summary: "Medicine recorded",
      actor_id: userId,
    });

    if (reminderSetup === "scheduled") {
      for (const time of parsed.data.times) {
        await supabase.from("reminders").insert({
          family_id: familyId,
          recipient_id: parsed.data.recipientId,
          title: `${parsed.data.name} · ${time}`,
          kind: "medicine",
          medicine_name: parsed.data.name,
          medicine_id: data.id,
          reminder_role: "dose",
          local_time: time,
          timezone: "Asia/Kolkata",
          recurrence: parsed.data.frequency === "weekly" ? "weekly" : "daily",
          status: "active",
          created_by: userId,
          is_sample: false,
        });
      }
    }

    await supabase.from("memory_events").insert({
      family_id: familyId,
      recipient_id: parsed.data.recipientId,
      type: "medicine_created",
      title: `${parsed.data.name} recorded`,
      actor_id: userId,
      ref_id: data.id,
    });

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Medicine write failed." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, familyId, userId } = await requireAuthedFamily();
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid medicine update." }, { status: 400 });

    const { data: current, error: readErr } = await supabase.from("medicines").select("*").eq("id", parsed.data.id).eq("family_id", familyId).maybeSingle();
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
    if (!current) return NextResponse.json({ error: "Medicine not found for this family." }, { status: 404 });

    const action = parsed.data.action;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (action === "pause") {
      patch.status = "paused";
      patch.reminder_setup = "paused";
    } else if (action === "resume") {
      patch.status = "active";
      patch.reminder_setup = current.times?.length ? "scheduled" : "needs_setup";
    } else if (action === "complete" || action === "stop" || action === "archive") {
      patch.status = action === "complete" ? "completed" : action === "stop" ? "stopped" : "archived";
      patch.ongoing = false;
      patch.reminder_setup = "paused";
      if (!current.end_date) patch.end_date = new Date().toISOString().slice(0, 10);
    } else if (action === "update" && parsed.data.draft) {
      const d = parsed.data.draft;
      if (d.recipientId !== current.recipient_id) {
        const { data: rec } = await supabase.from("care_recipients").select("id").eq("id", d.recipientId).eq("family_id", familyId).maybeSingle();
        if (!rec) return NextResponse.json({ error: "That person is not in this family." }, { status: 403 });
      }
      Object.assign(patch, {
        recipient_id: d.recipientId,
        name: d.name,
        strength: d.strength ?? null,
        dosage: d.dosage ?? null,
        route: d.route ?? null,
        frequency: d.frequency,
        times: d.times,
        start_date: d.startDate,
        end_date: d.ongoing ? null : d.endDate ?? null,
        ongoing: d.ongoing,
        prescriber: d.prescriber ?? null,
        instructions: d.instructions ?? null,
        source: d.source,
        notes: d.notes ?? null,
        reminder_setup: d.frequency === "as_needed" || d.times.length === 0 ? "needs_setup" : current.status === "paused" ? "paused" : "scheduled",
      });
    }

    const { error } = await supabase.from("medicines").update(patch).eq("id", parsed.data.id).eq("family_id", familyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("medicine_changes").insert({
      medicine_id: parsed.data.id,
      family_id: familyId,
      summary: action,
      previous: { name: current.name, times: current.times, status: current.status },
      actor_id: userId,
    });

    if (action === "pause" || action === "complete" || action === "stop" || action === "archive") {
      await supabase.from("reminders").update({ status: "paused" }).eq("medicine_id", parsed.data.id).eq("family_id", familyId).eq("reminder_role", "dose");
    }
    if (action === "resume") {
      await supabase.from("reminders").update({ status: "active" }).eq("medicine_id", parsed.data.id).eq("family_id", familyId).eq("reminder_role", "dose");
    }
    if (action === "update" && parsed.data.draft && parsed.data.draft.times.length) {
      const { data: existing } = await supabase.from("reminders").select("id, local_time, confirmation_status").eq("medicine_id", parsed.data.id).eq("family_id", familyId);
      const have = new Set((existing ?? []).map((r) => String(r.local_time).slice(0, 5)));
      for (const time of parsed.data.draft.times) {
        if (have.has(time)) {
          await supabase.from("reminders").update({ title: `${parsed.data.draft.name} · ${time}`, local_time: time, status: "active" }).eq("medicine_id", parsed.data.id).eq("family_id", familyId).eq("local_time", time);
        } else {
          await supabase.from("reminders").insert({
            family_id: familyId,
            recipient_id: parsed.data.draft.recipientId,
            title: `${parsed.data.draft.name} · ${time}`,
            kind: "medicine",
            medicine_name: parsed.data.draft.name,
            medicine_id: parsed.data.id,
            reminder_role: "dose",
            local_time: time,
            timezone: "Asia/Kolkata",
            recurrence: "daily",
            status: "active",
            created_by: userId,
            is_sample: false,
          });
        }
      }
    }

    return NextResponse.json({ ok: true, id: parsed.data.id });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Medicine update failed." }, { status: 500 });
  }
}
