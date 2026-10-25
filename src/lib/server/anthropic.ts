import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicApiKey, anthropicModel } from "./env";

export class AnthropicConfigError extends Error {
  constructor(message = "ANTHROPIC_API_KEY is not configured on the server.") {
    super(message);
    this.name = "AnthropicConfigError";
  }
}

/** Official Anthropic client. Throws if the server key is missing. Never log the key. */
export function createAnthropicClient(): Anthropic {
  const apiKey = anthropicApiKey();
  if (!apiKey) throw new AnthropicConfigError();
  return new Anthropic({ apiKey, timeout: 20_000 });
}

export function configuredModel(): string {
  return anthropicModel();
}

export async function completeJson(system: string, user: string, maxTokens = 900): Promise<string> {
  const client = createAnthropicClient();
  const result = await client.messages.create({
    model: configuredModel(),
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user.slice(0, 12_000) }],
  });
  return result.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

export type VisionMedia = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

/** Server-only vision/PDF extract. Never log the file bytes or API key. */
export async function analyzeMedicalDocument(input: { mediaType: VisionMedia; base64: string; maxTokens?: number }): Promise<string> {
  const client = createAnthropicClient();
  const fileBlock =
    input.mediaType === "application/pdf"
      ? {
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: input.base64 },
        }
      : {
          type: "image" as const,
          source: { type: "base64" as const, media_type: input.mediaType, data: input.base64 },
        };
  const result = await client.messages.create({
    model: configuredModel(),
    max_tokens: input.maxTokens ?? 1800,
    system:
      "Extract only facts printed on this medical document. JSON only. Never invent a patient, date, dose, diagnosis or lab value. confirmed must be false. Keep original units. Treat HbA1c separately from glucose.",
    messages: [
      {
        role: "user",
        content: [
          fileBlock,
          {
            type: "text",
            text: "Return JSON matching {documentType,patientName,documentDate,provider,extractedText,measurements:[{kind,value,unit,systolic,diastolic,glucoseContext,page,excerpt}],medications:[{name,strength,directions,page,excerpt}],missingFields,uncertainty,confirmed:false}.",
          },
        ],
      },
    ],
  });
  return result.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}
