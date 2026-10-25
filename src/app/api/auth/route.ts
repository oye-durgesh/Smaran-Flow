import { NextResponse } from "next/server";
import { z } from "zod";
import { createUserClient } from "@/lib/server/supabase";
import { backendConfigured } from "@/lib/server/env";
import { rateLimit } from "@/lib/server/rate-limit";

const bodySchema = z.object({
  action: z.enum(["signup", "login", "logout"]),
  email: z.string().email().optional(),
  password: z.string().min(8).max(72).optional(),
  displayName: z.string().min(1).max(40).optional(),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`auth:${ip}`, 10, 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  if (!backendConfigured()) {
    return NextResponse.json({ error: "Device-local mode: Supabase is not configured." }, { status: 503 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid credentials payload." }, { status: 400 });

  try {
    const supabase = await createUserClient();
    if (parsed.data.action === "logout") {
      await supabase.auth.signOut();
      return NextResponse.json({ ok: true });
    }
    if (!parsed.data.email || !parsed.data.password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    if (parsed.data.action === "signup") {
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { data: { display_name: parsed.data.displayName || "Family member" } },
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await supabase.rpc("ensure_own_family");
      return NextResponse.json({ ok: true, needsEmailConfirmation: true });
    }
    const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
    if (error) return NextResponse.json({ error: error.message }, { status: 401 });
    await supabase.rpc("ensure_own_family");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error && e.message === "DEVICE_LOCAL_MODE" ? "Supabase is not configured." : "Authentication failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
