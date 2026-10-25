import { NextResponse } from "next/server";
import { readSession } from "@/lib/server/session";

export async function GET() {
  const session = await readSession();
  return NextResponse.json({
    ...session,
    persistence: session.mode,
    cloud: session.authenticated,
    message: session.configured
      ? session.authenticated
        ? "Signed in. Family records load from Supabase under RLS."
        : "Supabase is configured. Sign in under Settings to use the family vault. Browser data is not the cloud."
      : "Device-local mode. NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. Nothing is cloud-synced.",
  });
}
