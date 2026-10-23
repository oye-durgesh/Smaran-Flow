import { isQuestion } from "./common";
import { looksLikeAppointment } from "./appointment";

export * from "./common";
export * from "./reminder";
export * from "./appointment";
export * from "./document";
export * from "./chat";
export * from "./ask";

export type CaptureIntent = "reminder" | "appointment" | "question";

/** Route free-form Wispr Flow text to the right SMARAN flow. */
export function classifyCapture(text: string): CaptureIntent {
  if (isQuestion(text)) return "question";
  if (looksLikeAppointment(text)) return "appointment";
  return "reminder";
}
