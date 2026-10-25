import { NextResponse } from "next/server";
import { detectFileKind, extractPdfText, MAX_EXTRACT_BYTES } from "@/lib/server/files";
import { parseLabText, SCAN_UNAVAILABLE } from "@/lib/document-extract";
import { rateLimit } from "@/lib/server/rate-limit";
import { readSession } from "@/lib/server/session";
import { backendConfigured } from "@/lib/server/env";

export const maxDuration = 30;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`extract:${ip}`, 8, 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  if (req.headers.get("x-smaran-consent") !== "cloud-extract") {
    return NextResponse.json({ error: "Consent is required before document content is processed off this device." }, { status: 403 });
  }
  const session = await readSession();
  if (backendConfigured() && !session.authenticated) {
    return NextResponse.json({ error: "Sign in to extract documents for your family." }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (file.size > MAX_EXTRACT_BYTES) return NextResponse.json({ error: "File exceeds the 4 MB processing limit." }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = detectFileKind(bytes);
  if (!kind) return NextResponse.json({ status: "failed", error: "File signature is not a supported PDF, JPEG, PNG or WebP.", extractedText: "" });

  if (kind === "application/pdf") {
    const extractedText = extractPdfText(bytes);
    if (!extractedText.trim()) {
      return NextResponse.json({
        status: "failed",
        error: "No selectable text in this PDF. Scanned OCR needs Claude vision or a dedicated worker. Nothing was saved as a successful extract.",
        extractedText: "",
        confirmed: false,
      });
    }
    const local = parseLabText(extractedText);
    return NextResponse.json({
      status: "needs_review",
      extractedText,
      proposal: null,
      fields: local.fields,
      confirmed: false,
      provider: "local_text",
      error: "Claude is not used in this phase. Selectable PDF text was extracted locally and needs human review.",
    });
  }

  return NextResponse.json({
    status: "not_extracted",
    error: SCAN_UNAVAILABLE,
    extractedText: "",
    confirmed: false,
    provider: "none",
  });
}
