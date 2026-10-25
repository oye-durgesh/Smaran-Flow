import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthedFamily, VaultError } from "@/lib/server/vault";
import { createUserClient } from "@/lib/server/supabase";
import { readSession } from "@/lib/server/session";
import { scheduleDemoTestReminder, seedDemoFamily } from "@/lib/server/demo-seed";
import { rateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  action: z.enum(["load", "reset", "switch", "test-reminder"]),
  familyId: z.string().uuid().optional(),
  confirm: z.boolean().optional(),
  minutesAhead: z.number().int().min(1).max(10).optional(),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`demo:${ip}`, 8, 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid demo request." }, { status: 400 });
    const session = await readSession();
    if (!session.authenticated || !session.userId) return NextResponse.json({ error: "Sign in to manage the demo workspace." }, { status: 401 });
    const supabase = await createUserClient();

    if (parsed.data.action === "switch") {
      if (!parsed.data.familyId) return NextResponse.json({ error: "Choose a workspace." }, { status: 400 });
      const { error } = await supabase.rpc("set_active_family", { target: parsed.data.familyId });
      if (error) return NextResponse.json({ error: error.message.includes("FORBIDDEN") ? "You cannot open another family's workspace." : error.message }, { status: 403 });
      return NextResponse.json({ ok: true, familyId: parsed.data.familyId });
    }

    if (parsed.data.action === "test-reminder") {
      const result = await scheduleDemoTestReminder(supabase, session.userId, parsed.data.minutesAhead ?? 2);
      return NextResponse.json({ ok: true, ...result });
    }

    if (parsed.data.action === "reset" && !parsed.data.confirm) {
      return NextResponse.json({ error: "Reset requires explicit confirmation." }, { status: 400 });
    }
    if (parsed.data.action === "load" && !parsed.data.confirm) {
      return NextResponse.json({ error: "Load requires explicit confirmation." }, { status: 400 });
    }

    await requireAuthedFamily();
    const result = await seedDemoFamily(supabase, session.userId, { reset: parsed.data.action === "reset" });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Demo workspace update failed." }, { status: 500 });
  }
}
