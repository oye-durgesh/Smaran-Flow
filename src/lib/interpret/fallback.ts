import type { ProposedAction } from "./zod";

export function isComplexLanguage(text: string): boolean {
  const t = text.trim();
  if (t.length > 140) return true;
  if (/[।]/.test(t)) return true;
  if (/\b(actually|wait|nahi wo|matlab|correction|instead|pehla nahi|dusra)\b/i.test(t)) return true;
  if ((t.match(/\b(aur|and|phir|then)\b/gi) ?? []).length >= 2) return true;
  const hasDevanagari = /[\u0900-\u097F]/.test(t);
  const hasLatin = /[a-zA-Z]{4,}/.test(t);
  return hasDevanagari && hasLatin && t.split(/\s+/).length > 12;
}

export function needsClaudeFallback(actions: ProposedAction[], transcript: string): boolean {
  if (!actions.length) return true;
  if (actions.length > 1) return true;
  const action = actions[0];
  if (action.intent === "unknown") return isComplexLanguage(transcript);
  if (action.confidence < 0.55) return true;
  if (action.missingFields.length >= 2 && isComplexLanguage(transcript)) return true;
  return false;
}
