import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dateOf, realNow } from "@/lib/dates";
import { DEMO_SEED_VERSION } from "@/lib/demo/workspace";
import { buildDemoDataset, datasetCounts } from "@/lib/demo/seed-dataset";

async function chunked<T>(items: T[], size: number, write: (slice: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await write(items.slice(i, i + size));
  }
}

function fail(error: { message?: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

export async function seedDemoFamily(supabase: SupabaseClient, userId: string, opts: { reset?: boolean } = {}) {
  if (opts.reset) {
    const { error } = await supabase.rpc("reset_demo_family_records");
    fail(error, "reset");
  }
  const { data: familyId, error: famErr } = await supabase.rpc("ensure_demo_family");
  fail(famErr, "ensure demo family");
  const fid = String(familyId);

  const { data: fam } = await supabase.from("families").select("id, demo_seed_version, is_demo").eq("id", fid).maybeSingle();
  if (!fam?.is_demo) throw new Error("Refusing to seed a non-demo family.");

  if (!opts.reset && fam.demo_seed_version === DEMO_SEED_VERSION) {
    const { count } = await supabase.from("care_recipients").select("id", { count: "exact", head: true }).eq("family_id", fid);
    return { familyId: fid, reused: true, summary: { people: count ?? 0, version: DEMO_SEED_VERSION } };
  }

  const referenceDate = dateOf(realNow());
  const ds = buildDemoDataset(referenceDate);
  const people: Record<string, string> = {};

  for (const p of ds.people) {
    const { data, error } = await supabase
      .from("care_recipients")
      .upsert(
        {
          family_id: fid,
          display_name: p.name,
          relationship: p.relationship,
          age: p.age,
          color_key: p.colorKey,
          seed_key: p.seedKey,
          created_by: userId,
        },
        { onConflict: "family_id,seed_key" },
      )
      .select("id, seed_key")
      .single();
    if (error || !data) {
      const existing = await supabase.from("care_recipients").select("id").eq("family_id", fid).eq("seed_key", p.seedKey).maybeSingle();
      if (!existing.data) throw new Error(error?.message || "Recipient seed failed.");
      people[p.key] = existing.data.id;
    } else {
      people[p.key] = data.id;
    }
  }

  const doctorIds: Record<string, string> = {};
  for (const d of ds.doctors) {
    const { data, error } = await supabase
      .from("family_doctors")
      .upsert(
        {
          family_id: fid,
          name: d.name,
          category: d.category,
          specialty: d.specialty,
          clinic: d.clinic,
          recipient_ids: Object.values(people),
          archived: false,
          is_sample: true,
          seed_key: d.seedKey,
        },
        { onConflict: "family_id,seed_key" },
      )
      .select("id")
      .single();
    if (error || !data) {
      const existing = await supabase.from("family_doctors").select("id").eq("family_id", fid).eq("seed_key", d.seedKey).maybeSingle();
      if (!existing.data) throw new Error(error?.message || "Doctor seed failed.");
      doctorIds[d.seedKey] = existing.data.id;
    } else doctorIds[d.seedKey] = data.id;
  }

  const medicineIds: Record<string, string> = {};
  for (const m of ds.medicines) {
    const { data, error } = await supabase
      .from("medicines")
      .upsert(
        {
          family_id: fid,
          recipient_id: people[m.person],
          name: m.name,
          strength: m.strength,
          dosage: m.dosage,
          frequency: m.frequency,
          times: m.times,
          start_date: m.start,
          end_date: m.end ?? null,
          ongoing: m.ongoing,
          status: m.status,
          source: "other",
          notes: m.notes,
          reminder_setup: "scheduled",
          created_by: userId,
          is_sample: true,
          seed_key: m.seedKey,
        },
        { onConflict: "family_id,seed_key" },
      )
      .select("id")
      .single();
    if (error || !data) {
      const existing = await supabase.from("medicines").select("id").eq("family_id", fid).eq("seed_key", m.seedKey).maybeSingle();
      if (!existing.data) throw new Error(error?.message || "Medicine seed failed.");
      medicineIds[m.seedKey] = existing.data.id;
    } else medicineIds[m.seedKey] = data.id;
  }

  for (const r of ds.refills) {
    const { error } = await supabase.from("medicine_refills").upsert(
      {
        family_id: fid,
        medicine_id: medicineIds[r.medicine],
        recipient_id: people[r.person],
        remaining_quantity: r.remaining,
        unit: r.unit,
        units_per_dose: r.perDose,
        planned_date: r.planned,
        reminder_date: r.planned,
        reminder_time: "18:00",
        status: "upcoming",
        notes: "Sample demo refill — fictional stock.",
        seed_key: r.seedKey,
      },
      { onConflict: "family_id,seed_key" },
    );
    fail(error, "refill");
  }

  for (const r of ds.reminders) {
    const { error } = await supabase.from("reminders").upsert(
      {
        family_id: fid,
        recipient_id: people[r.person],
        kind: r.kind,
        title: r.title,
        medicine_name: r.medicine,
        local_time: r.time,
        local_date: "date" in r ? (r as { date?: string }).date ?? null : null,
        timezone: "Asia/Kolkata",
        recurrence: r.recurrence,
        status: "active",
        created_by: userId,
        is_sample: true,
        medicine_id: medicineIds[r.medicine] ?? null,
        reminder_role: r.role,
        seed_key: r.seedKey,
      },
      { onConflict: "family_id,seed_key" },
    );
    fail(error, "reminder");
  }

  for (const a of ds.appointments) {
    const { error } = await supabase.from("appointments").upsert(
      {
        family_id: fid,
        recipient_id: people[a.person],
        doctor: a.doctor,
        local_date: a.date,
        local_time: a.time,
        starts_at: `${a.date}T${a.time}:00+05:30`,
        timezone: "Asia/Kolkata",
        status: a.status,
        created_by: userId,
        is_sample: true,
        clinic: a.clinic,
        purpose: a.purpose,
        doctor_id: doctorIds[a.doctorKey] ?? null,
        follow_up_date: a.followUpDate ?? null,
        seed_key: a.seedKey,
        location: a.clinic,
        notes: "Sample demo appointment — not an external booking.",
      },
      { onConflict: "family_id,seed_key" },
    );
    fail(error, "appointment");
  }

  for (const d of ds.documents) {
    const { error } = await supabase.from("documents").upsert(
      {
        family_id: fid,
        recipient_id: people[d.person],
        storage_path: "demo-preview",
        extract_status: "needs_review",
        extracted_text: d.preview,
        preview_text: d.preview,
        name: d.name,
        category: d.category,
        report_date: d.date,
        mime: "text/plain",
        byte_size: d.preview.length,
        created_by: userId,
        is_sample: true,
        seed_key: d.seedKey,
      },
      { onConflict: "family_id,seed_key" },
    );
    fail(error, "document");
  }

  for (const h of ds.history) {
    const { error } = await supabase.from("medical_history").upsert(
      {
        family_id: fid,
        recipient_id: people[h.person],
        category: h.category,
        name: h.name,
        notes: h.notes,
        created_by: userId,
        is_sample: true,
        seed_key: h.seedKey,
      },
      { onConflict: "family_id,seed_key" },
    );
    fail(error, "history");
  }

  for (const v of ds.vaccinations) {
    const { error } = await supabase.from("vaccinations").upsert(
      {
        family_id: fid,
        recipient_id: people[v.person],
        name: v.name,
        dose: v.dose,
        received_date: v.received,
        next_due_date: v.next,
        notes: "Sample demo vaccination fixture. Not a schedule recommendation.",
        created_by: userId,
        is_sample: true,
        seed_key: v.seedKey,
      },
      { onConflict: "family_id,seed_key" },
    );
    fail(error, "vaccination");
  }

  for (const n of ds.diary) {
    const { error } = await supabase.from("health_diary").upsert(
      {
        family_id: fid,
        recipient_id: people[n.person],
        title: n.title,
        body: n.body,
        recorded_at: `${ds.created}:00+05:30`,
        created_by: userId,
        is_sample: true,
        seed_key: n.seedKey,
      },
      { onConflict: "family_id,seed_key" },
    );
    fail(error, "diary");
  }

  await chunked(ds.measurements, 80, async (slice) => {
    const { error } = await supabase.from("health_measurements").upsert(
      slice.map((m) => ({
        family_id: fid,
        recipient_id: people[m.person],
        kind: m.kind,
        value: m.value,
        unit: m.unit,
        systolic: m.systolic ?? null,
        diastolic: m.diastolic ?? null,
        glucose_context: m.glucoseContext ?? null,
        recorded_at: `${m.recordedAt}:00+05:30`,
        author_id: userId,
        source_type: "sample",
        source_id: m.seedKey,
        confirmation_status: "family_reported",
        note: m.note,
        is_sample: true,
        seed_key: m.seedKey,
      })),
      { onConflict: "family_id,seed_key" },
    );
    fail(error, "measurements");
  });

  for (const m of ds.memory) {
    const { error } = await supabase.from("memory_events").upsert(
      {
        family_id: fid,
        recipient_id: people[m.person],
        type: "document_added",
        title: m.title,
        description: "Sample demo timeline event linked to a seeded record.",
        created_at: `${m.at}:00+05:30`,
        is_sample: true,
        seed_key: m.seedKey,
      },
      { onConflict: "family_id,seed_key" },
    );
    fail(error, "memory");
  }

  const { error: markErr } = await supabase
    .from("families")
    .update({ demo_seed_version: DEMO_SEED_VERSION, demo_reference_date: referenceDate })
    .eq("id", fid)
    .eq("is_demo", true);
  fail(markErr, "mark seed version");

  return { familyId: fid, reused: false, summary: datasetCounts(ds), referenceDate };
}

export async function scheduleDemoTestReminder(supabase: SupabaseClient, userId: string, minutesAhead: number) {
  const { data: familyId, error } = await supabase.rpc("ensure_demo_family");
  fail(error, "ensure demo family");
  const fid = String(familyId);
  const { data: fam } = await supabase.from("families").select("is_demo").eq("id", fid).maybeSingle();
  if (!fam?.is_demo) throw new Error("Test reminders stay in the demo family.");
  const { data: person } = await supabase.from("care_recipients").select("id").eq("family_id", fid).eq("seed_key", "person-mummy").maybeSingle();
  if (!person) throw new Error("Load demo family data before scheduling a test reminder.");
  const now = new Date();
  now.setMinutes(now.getMinutes() + Math.max(1, Math.min(10, minutesAhead)));
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const { data, error: ins } = await supabase
    .from("reminders")
    .upsert(
      {
        family_id: fid,
        recipient_id: person.id,
        kind: "other",
        title: "Demo test reminder",
        local_time: `${hh}:${mm}`,
        local_date: date,
        timezone: "Asia/Kolkata",
        recurrence: "once",
        status: "active",
        created_by: userId,
        is_sample: true,
        seed_key: "rem-demo-test",
      },
      { onConflict: "family_id,seed_key" },
    )
    .select("id")
    .single();
  fail(ins, "test reminder");
  return { familyId: fid, reminderId: data?.id, dueLocal: `${date}T${hh}:${mm}` };
}
