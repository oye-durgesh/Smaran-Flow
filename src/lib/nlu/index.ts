import { isQuestion } from "./common";
import { looksLikeAppointment } from "./appointment";
import { looksLikeHealth } from "./health";

export * from "./common";
export * from "./reminder";
export * from "./appointment";
export * from "./document";
export * from "./chat";
export * from "./ask";
export * from "./health";
export * from "./command";

export type CaptureIntent = "reminder" | "appointment" | "question" | "health";

/** Route free-form Wispr Flow text to the right SMARAN flow. */
export function classifyCapture(text: string): CaptureIntent {
  if (looksLikeHealth(text)) return "health";
  if (isQuestion(text)) return "question";
  if (looksLikeAppointment(text)) return "appointment";
  return "reminder";
}
