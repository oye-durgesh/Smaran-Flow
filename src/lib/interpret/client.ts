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
  // This phase uses the deterministic rules engine only. Claude is not called.
  return localResponse(transcript, state, session);
}

export function primaryAction(result: InterpretResponse): ProposedAction {
  return result.actions[0];
}
