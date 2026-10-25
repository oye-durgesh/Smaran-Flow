import { NextResponse } from "next/server";
import { requireAuthedFamily, VaultError } from "@/lib/server/vault";
import { processDueRemindersForFamily } from "@/lib/server/in-app-processor";

export async function POST() {
  try {
    const { familyId } = await requireAuthedFamily();
    const result = await processDueRemindersForFamily(familyId);
    return NextResponse.json({
      ok: !result.error,
      created: result.created,
      duplicates: result.duplicates,
      skipped: result.skipped,
      error: result.error,
    });
  } catch (e) {
    if (e instanceof VaultError) return NextResponse.json({ error: e.message, created: 0 }, { status: e.status });
    return NextResponse.json({ error: "Could not process due reminders.", created: 0 }, { status: 500 });
  }
}
