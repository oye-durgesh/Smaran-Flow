import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthedFamily, VaultError, resolveAppointmentAction, setAppointmentStatusDb, rescheduleAppointmentDb, loadVault } from "@/lib/server/vault";

const createSchema = z.object({
  recipientId: z.string().uuid(),
  doctor: z.string().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  location: z.string().max(120).optional(),
  notes: z.string().max(400).optional(),
});

const actionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["complete", "cancel", "reschedule", "upcoming"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
});

const matchSchema = z.object({
  text: z.string().min(1).max(4000),
  date: z.string().optional(),
  doctor: z.string().optional(),
});

export async function GET() {
  try {
    const { supabase, familyId } = await requireAuthedFamily();
    const vault = await loadVault(supabase, familyId);
    return NextResponse.json({ appointments: vault.appointments, family: vault.family });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Could not list appointments." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, familyId, userId } = await requireAuthedFamily();
    const raw = await req.json();
    if (raw?.match) {
      const q = matchSchema.safeParse(raw);
      if (!q.success) return NextResponse.json({ error: "Invalid match query." }, { status: 400 });
      const vault = await loadVault(supabase, familyId);
      const resolved = resolveAppointmentAction(vault.appointments, vault.family, q.data.text, q.data.date, q.data.doctor);
      if (!resolved.ok) {
        return NextResponse.json({
          ok: false,
          reason: resolved.reason,
          ids: resolved.ids,
          clarification: resolved.reason === "ambiguous" ? "Which appointment do you mean?" : "No matching upcoming appointment. Nothing was changed.",
        });
      }
      return NextResponse.json({ ok: true, appointment: resolved.appointment });
    }
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Invalid appointment." }, { status: 400 });
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        family_id: familyId,
        recipient_id: parsed.data.recipientId,
        doctor: parsed.data.doctor,
        local_date: parsed.data.date,
        local_time: parsed.data.time,
        starts_at: `${parsed.data.date}T${parsed.data.time}:00+05:30`,
        timezone: "Asia/Kolkata",
        status: "upcoming",
        location: parsed.data.location,
        notes: parsed.data.notes,
        created_by: userId,
        is_sample: false,
      })
      .select("*")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || "Create failed." }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, created_at: data.created_at });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Appointment write failed." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, familyId, userId } = await requireAuthedFamily();
    const parsed = actionSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid appointment action." }, { status: 400 });
    if (parsed.data.action === "reschedule") {
      if (!parsed.data.date || !parsed.data.time) return NextResponse.json({ error: "Reschedule needs a date and time." }, { status: 400 });
      const row = await rescheduleAppointmentDb(supabase, familyId, userId, parsed.data.id, parsed.data.date, parsed.data.time);
      return NextResponse.json({ ok: true, appointment: row });
    }
    const status = parsed.data.action === "complete" ? "completed" : parsed.data.action === "cancel" ? "cancelled" : "upcoming";
    const row = await setAppointmentStatusDb(supabase, familyId, userId, parsed.data.id, status);
    return NextResponse.json({ ok: true, appointment: row });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Appointment update failed." }, { status: 500 });
  }
}
