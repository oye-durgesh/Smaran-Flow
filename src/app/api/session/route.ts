import { NextResponse } from "next/server";
import { readSession } from "@/lib/server/session";

export async function GET() {
  const session = await readSession();
  return NextResponse.json({
    ...session,
    persistence: session.mode,
    cloud: session.authenticated,
    isDemo: session.isDemo ?? false,
    workspaces: session.workspaces ?? [],
    demoSeedVersion: session.demoSeedVersion ?? null,
    demoReferenceDate: session.demoReferenceDate ?? null,
    message: session.configured
      ? session.authenticated
        ? session.isDemo
          ? "Signed in to SMARAN Demo Family. Records are fictional demo fixtures."
          : "Signed in. Family records load from Supabase under RLS."
        : "Supabase is configured. Sign in under Settings to use the family vault. Browser data is not the cloud."
      : "Device-local mode. NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set. Nothing is cloud-synced.",
  });
}
