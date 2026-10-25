import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rate-limit";
import { readSession } from "@/lib/server/session";
import { runInterpretation } from "@/lib/server/run-interpret";

export const maxDuration = 30;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`ai-interpret:${ip}`)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > 20_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    raw = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "We could not read that request." }, { status: 400 });
  }
  const result = await runInterpretation(raw, await readSession());
  return NextResponse.json(result.body, { status: result.status });
}
