import { NextResponse } from "next/server";
import { detectFileKind, extractPdfText, MAX_EXTRACT_BYTES } from "@/lib/server/files";
import { parseLabText, SCAN_UNAVAILABLE } from "@/lib/document-extract";
import { rateLimit } from "@/lib/server/rate-limit";
import { readSession } from "@/lib/server/session";
import { backendConfigured, claudeConfigured } from "@/lib/server/env";
import { AnthropicConfigError, analyzeMedicalDocument, type VisionMedia } from "@/lib/server/anthropic";
import { extractionProposalSchema } from "@/lib/interpret/zod";

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
    if (extractedText.trim()) {
      const local = parseLabText(extractedText);
      return NextResponse.json({
        status: "needs_review",
        extractedText,
        proposal: null,
        fields: local.fields,
        confirmed: false,
        provider: "local_text",
      });
    }
    return visionOrUnavailable(bytes, "application/pdf", "No selectable text in this PDF.");
  }

  const media = kind as VisionMedia;
  return visionOrUnavailable(bytes, media, SCAN_UNAVAILABLE);
}

async function visionOrUnavailable(bytes: Buffer, mediaType: VisionMedia, emptyMessage: string) {
  if (!claudeConfigured()) {
    return NextResponse.json({
      status: "not_extracted",
      error: `${emptyMessage} Provider OCR is unavailable because ANTHROPIC_API_KEY is not configured. The original file is unchanged.`,
      extractedText: "",
      confirmed: false,
      provider: "none",
    });
  }
  try {
    const raw = await analyzeMedicalDocument({ mediaType, base64: bytes.toString("base64") });
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < 0) {
      return NextResponse.json({
        status: "failed",
        error: "The extraction provider returned unstructured text. Nothing was confirmed.",
        extractedText: "",
        confirmed: false,
        provider: "claude",
      });
    }
    const parsed = extractionProposalSchema.safeParse(JSON.parse(raw.slice(start, end + 1)));
    if (!parsed.success) {
      return NextResponse.json({
        status: "needs_review",
        extractedText: "",
        proposal: null,
        confirmed: false,
        provider: "claude",
        error: "Model output failed validation. Review the original file. Nothing was saved as confirmed.",
      });
    }
    return NextResponse.json({
      status: "needs_review",
      extractedText: parsed.data.extractedText,
      proposal: { ...parsed.data, confirmed: false },
      confirmed: false,
      provider: "claude",
    });
  } catch (error) {
    if (error instanceof AnthropicConfigError) {
      return NextResponse.json({
        status: "not_extracted",
        error: SCAN_UNAVAILABLE,
        extractedText: "",
        confirmed: false,
        provider: "none",
      });
    }
    return NextResponse.json({
      status: "failed",
      error: "Extraction failed. The original file is unchanged.",
      extractedText: "",
      confirmed: false,
      provider: "claude",
    });
  }
}
