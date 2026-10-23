import type { AppState } from "../types";
import { isQuestion } from "./common";
import { looksLikeAppointment } from "./appointment";
import { looksLikeHealth, parseHealth, type HealthDraft } from "./health";

export type CommandIntent = "health" | "question" | "appointment" | "reminder";

export interface ParsedCommand {
  intent: CommandIntent;
  health?: HealthDraft;
  text: string;
}

export function parseSmaranCommand(text: string, state: AppState): ParsedCommand {
  const trimmed = text.trim();
  if (looksLikeHealth(trimmed)) return { intent: "health", health: parseHealth(trimmed, state.family), text: trimmed };
  if (isQuestion(trimmed)) return { intent: "question", text: trimmed };
  if (looksLikeAppointment(trimmed)) return { intent: "appointment", text: trimmed };
  return { intent: "reminder", text: trimmed };
}
