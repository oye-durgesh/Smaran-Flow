import type { AppState } from "../types";
import type { InterpretSession } from "./schema";
import { interpretLocally } from "../nlu/intents";
import { splitUtterances } from "../nlu/split";
import type { InterpretResponse, ProposedAction } from "./zod";
import { proposedActionSchema } from "./zod";

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
    if (!res.ok) throw new Error(data.error || "interpret_failed");
    if (!Array.isArray(data.actions) || data.actions.length === 0) throw new Error("empty_actions");
    return data;
  } catch {
    return localResponse(transcript, state, session);
  }
}

export function primaryAction(result: InterpretResponse): ProposedAction {
  return result.actions[0];
}
