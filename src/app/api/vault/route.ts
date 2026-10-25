import { NextResponse } from "next/server";
import { loadVault, requireAuthedFamily, VaultError } from "@/lib/server/vault";
import { realNow } from "@/lib/dates";

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
