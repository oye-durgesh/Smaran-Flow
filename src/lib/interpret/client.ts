import type { AppState } from "../types";
import type { InterpretSession } from "./schema";
import { interpretLocally } from "../nlu/intents";
import { splitUtterances } from "../nlu/split";
import type { InterpretResponse, ProposedAction } from "./zod";
import { proposedActionSchema } from "./zod";
import { needsClaudeFallback } from "./fallback";

function localResponse(transcript: string, state: AppState, session?: InterpretSession): InterpretResponse {
  const actions = splitUtterances(transcript).map((part) => {
    const draft = interpretLocally(part, state, session);
    return proposedActionSchema.parse({ ...draft, familyAge: draft.familyFact?.value });
  });
  return {
    session: session ?? "general_reminder",
    provider: "rules",
    claudeUsed: false,
    persistence: "device-local",
    authorization: "device-local-unauthenticated",
    actions,
  };
}

export async function requestInterpretation(transcript: string, state: AppState, session?: InterpretSession): Promise<InterpretResponse> {
  const local = localResponse(transcript, state, session);
  if (!needsClaudeFallback(local.actions, transcript)) return local;
  try {
    const res = await fetch("/api/ai/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,
        session,
        timezone: "Asia/Kolkata",
        deviceFamilyNames: state.family.map((m) => m.name),
        deviceAppointments: state.appointments.map((a) => ({
          id: a.id,
          familyMemberId: a.familyMemberId,
          doctor: a.doctor,
          date: a.date,
          time: a.time,
          status: a.status,
        })),
      }),
    });
    const data = (await res.json()) as InterpretResponse & { error?: string };
    if (!res.ok) {
      return { ...local, error: data.error || "Complex-language fallback is unavailable." };
    }
    if (!Array.isArray(data.actions) || data.actions.length === 0) {
      return { ...local, error: "The language fallback returned nothing. Used the local parser." };
    }
    return data;
  } catch {
    return { ...local, error: "Complex-language fallback is unavailable. Used the local parser. Nothing was saved." };
  }
}

export function primaryAction(result: InterpretResponse): ProposedAction {
  return result.actions[0];
}
