import { z } from "zod";

export const sessionSchema = z.enum(["general_reminder", "appointment", "medicine_reminder", "health_update", "ask", "document", "family", "general", "reminder"]);

export const actionIntentSchema = z.enum([
  "health_measurement",
  "after_visit_note",
  "medicine_reminder",
  "health_check_reminder",
  "pickup_reminder",
  "appointment_create_or_update",
  "appointment_complete",
  "appointment_cancel",
  "appointment_reschedule",
  "family_fact",
  "ask_question",
  "document_question",
  "unknown",
]);

export const proposedActionSchema = z.object({
  intent: actionIntentSchema,
  transcript: z.string().max(4000),
  timezone: z.string().default("Asia/Kolkata"),
  memberId: z.string().optional(),
  memberName: z.string().optional(),
  title: z.string().optional(),
  medicineName: z.string().optional(),
  kind: z.enum(["medicine", "check", "pickup", "other"]).optional(),
  measurementKind: z.enum(["blood_pressure", "blood_sugar", "weight", "heart_rate"]).optional(),
  measurementValue: z.string().optional(),
  unit: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  frequency: z.enum(["once", "daily", "weekly"]).optional(),
  weekday: z.number().int().min(0).max(6).optional(),
  doctor: z.string().optional(),
  location: z.string().optional(),
  note: z.string().optional(),
  familyAge: z.number().int().min(1).max(120).optional(),
  matchedAppointmentIds: z.array(z.string()).optional(),
  missingFields: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  clarificationQuestion: z.string().optional(),
  sourceSpan: z.string().optional(),
  requiresConfirmation: z.boolean().default(true),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const interpretBodySchema = z.object({
  transcript: z.string().min(0).max(4000),
  session: sessionSchema.optional(),
  timezone: z.string().max(64).optional(),
  /** Display names only. Server never treats these IDs as authorized records. */
  deviceFamilyNames: z.array(z.string().min(1).max(40)).max(20).optional(),
  /** Used only in device-local mode so interpret can match the same records the UI shows. Ignored when a family session exists. */
  deviceAppointments: z
    .array(
      z.object({
        id: z.string(),
        familyMemberId: z.string(),
        doctor: z.string(),
        date: z.string(),
        time: z.string(),
        status: z.enum(["upcoming", "completed", "cancelled"]),
      }),
    )
    .max(50)
    .optional(),
});

export const interpretResponseSchema = z.object({
  session: z.string(),
  provider: z.enum(["rules", "claude"]),
  claudeUsed: z.boolean(),
  persistence: z.enum(["supabase", "device-local"]),
  authorization: z.enum(["family-scoped", "device-local-unauthenticated"]),
  actions: z.array(proposedActionSchema).min(1),
  error: z.string().optional(),
});

export const askBodySchema = z.object({
  question: z.string().min(1).max(4000),
  timezone: z.string().optional(),
  filterMemberId: z.string().optional(),
  evidence: z
    .object({
      family: z.array(z.object({ id: z.string(), name: z.string(), relationship: z.string().optional() })).max(20),
      appointments: z.array(z.object({ id: z.string(), familyMemberId: z.string(), doctor: z.string(), date: z.string(), time: z.string(), status: z.string() })).max(50),
      reminders: z.array(z.object({ id: z.string(), familyMemberId: z.string(), title: z.string(), kind: z.string(), time: z.string(), frequency: z.string() })).max(50),
      measurements: z.array(z.object({ id: z.string(), familyMemberId: z.string(), kind: z.string(), value: z.string(), unit: z.string(), recordedAt: z.string(), systolic: z.number().optional(), diastolic: z.number().optional(), glucoseContext: z.string().optional() })).max(80),
      documents: z.array(z.object({ id: z.string(), familyMemberId: z.string(), name: z.string(), type: z.string(), date: z.string() })).max(50),
    })
    .optional(),
});

export const extractionProposalSchema = z.object({
  documentType: z.string().nullable(),
  patientName: z.string().nullable(),
  documentDate: z.string().nullable(),
  provider: z.string().nullable(),
  extractedText: z.string(),
  measurements: z.array(z.object({ kind: z.string(), value: z.string(), unit: z.string().nullable(), page: z.number().nullable(), excerpt: z.string().nullable() })),
  medications: z.array(z.object({ name: z.string(), strength: z.string().nullable(), directions: z.string().nullable(), page: z.number().nullable(), excerpt: z.string().nullable() })),
  missingFields: z.array(z.string()),
  uncertainty: z.string().nullable(),
  confirmed: z.literal(false),
});

export type ProposedAction = z.infer<typeof proposedActionSchema>;
export type InterpretResponse = z.infer<typeof interpretResponseSchema>;

export function parseModelJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("malformed_model_output");
  return JSON.parse(text.slice(start, end + 1));
}
