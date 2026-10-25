import { NextResponse } from "next/server";
import { loadVault, requireAuthedFamily, wipeOwnedFamilyRecords, VaultError } from "@/lib/server/vault";
import { realNow } from "@/lib/dates";
import { z } from "zod";

export async function GET() {
  try {
    const { supabase, familyId, userId } = await requireAuthedFamily();
    const vault = await loadVault(supabase, familyId);
    return NextResponse.json({
      persistence: "supabase",
      familyId,
      userId,
      recordedAt: realNow(),
      ...vault,
    });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message, persistence: e.status === 503 ? "device-local" : "supabase" }, { status: e.status });
    return NextResponse.json({ error: "Could not load the family vault." }, { status: 500 });
  }
}

const wipeSchema = z.object({ confirm: z.literal("delete-all-my-smaran-records") });

export async function DELETE(req: Request) {
  try {
    const parsed = wipeSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Confirm delete-all-my-smaran-records to wipe your vaults." }, { status: 400 });
    const { supabase, userId } = await requireAuthedFamily();
    const result = await wipeOwnedFamilyRecords(supabase, userId);
    if (result.errors.length) return NextResponse.json({ error: result.errors[0], ...result }, { status: 500 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Could not wipe the family vault." }, { status: 500 });
  }
}
