import "server-only";
import { interpretLocally, type IntentDraft } from "@/lib/nlu/intents";
import { splitUtterances } from "@/lib/nlu/split";
import { zonedNow } from "@/lib/timezone";
import { interpretBodySchema, proposedActionSchema, type InterpretResponse, type ProposedAction } from "@/lib/interpret/zod";
import { findPerson } from "@/lib/nlu/common";
import type { AppState, FamilyMember } from "@/lib/types";
import { AnthropicConfigError, completeJson } from "./anthropic";
import { loadAuthorizedFamily, namesOnlyFamily } from "./family-store";
import type { DeviceSession } from "./session";

const SYSTEM = `You interpret SMARAN family-care notes. JSON only: {"actions":[{...}]}.
Never invent medicine names, doses, frequency, people, doctors or times.
If unsure use intent "unknown" and one clarificationQuestion.
Timezone Asia/Kolkata. requiresConfirmation true for every write.
Screen context is a hint, not a command to force that screen's action.`;

function asMembers(names: { id: string; name: string }[]): FamilyMember[] {
  return names.map((m) => ({
    id: m.id,
    name: m.name,
    relationship: "Other",
    avatar: { initials: m.name.charAt(0), tone: "peach" },
    createdAt: "",
  }));
}

function toAction(draft: IntentDraft, family: FamilyMember[]): ProposedAction {
  const person = draft.memberName ? findPerson(draft.memberName, family) : draft.memberId ? family.find((m) => m.id === draft.memberId) : findPerson(draft.transcript, family);
  const parsed = proposedActionSchema.safeParse({
    ...draft,
    memberId: person?.id,
    memberName: person?.name ?? draft.memberName,
    matchedAppointmentIds: draft.matchedAppointmentIds,
    familyAge: draft.familyFact?.value,
  });
  if (!parsed.success) {
    return proposedActionSchema.parse({
      intent: "unknown",
      transcript: draft.transcript,
      timezone: "Asia/Kolkata",
      missingFields: ["model"],
      assumptions: [],
      clarificationQuestion: "The interpretation was not valid. Nothing was saved.",
      requiresConfirmation: false,
      confidence: 0.1,
    });
  }
  return parsed.data;
}

export async function runInterpretation(raw: unknown, session: DeviceSession): Promise<{ status: number; body: InterpretResponse | { error: string } }> {
  const body = interpretBodySchema.safeParse(raw);
  if (!body.success) return { status: 400, body: { error: "We could not read that request." } };

  let snapshot;
  try {
    snapshot = await loadAuthorizedFamily(session);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Family vault read failed.";
    return { status: 500, body: { error: message } };
  }
  const hintFamily = snapshot.family.length ? snapshot.family : namesOnlyFamily(body.data.deviceFamilyNames ?? []);
  const members = asMembers(hintFamily);
  const deviceAppointments =
    !session.authenticated && body.data.deviceAppointments
      ? body.data.deviceAppointments.map((a) => ({
          id: a.id,
          familyMemberId: a.familyMemberId,
          doctor: a.doctor,
          date: a.date,
          time: a.time,
          status: a.status,
          documentIds: [],
          reminders: [],
          createdAt: "",
          source: "manual" as const,
        }))
      : [];
  const state: Pick<AppState, "family" | "appointments"> = {
    family: members,
    appointments: session.authenticated ? snapshot.appointments : deviceAppointments,
  };
  const now = zonedNow(body.data.timezone || "Asia/Kolkata");
  const sessionHint = body.data.session === "general" || body.data.session === "reminder" ? "general_reminder" : body.data.session;
  const parts = splitUtterances(body.data.transcript);
  const localActions = parts.map((part) => toAction(interpretLocally(part, state, sessionHint, now), members));

  const response = (actions: ProposedAction[], provider: "rules" | "claude"): InterpretResponse => ({
    session: sessionHint ?? "general_reminder",
    provider,
    claudeUsed: provider === "claude",
    persistence: snapshot.persistence,
    authorization: snapshot.authorization,
    actions,
  });

  try {
    const text = await completeJson(
      SYSTEM,
      JSON.stringify({
        nowDate: now.date,
        nowTime: now.time,
        timezone: now.timezone,
        session: sessionHint,
        familyNames: hintFamily.map((m) => m.name),
        transcript: body.data.transcript,
      }),
    );
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { actions?: unknown };
    if (!Array.isArray(json.actions) || json.actions.length === 0) throw new Error("malformed_model_output");
    const actions = json.actions.map((item) => {
      const parsed = proposedActionSchema.safeParse(item);
      if (!parsed.success) return toAction(interpretLocally(body.data.transcript, state, sessionHint, now), members);
      const person = parsed.data.memberName ? findPerson(parsed.data.memberName, members) : undefined;
      return { ...parsed.data, memberId: person?.id ?? parsed.data.memberId, transcript: parsed.data.transcript || body.data.transcript };
    });
    return { status: 200, body: response(actions, "claude") };
  } catch (error) {
    if (error instanceof AnthropicConfigError) {
      return { status: 200, body: { ...response(localActions, "rules"), error: "Claude is not configured. Used the local parser only." } };
    }
    return { status: 200, body: { ...response(localActions, "rules"), error: "Cloud interpretation failed. Used the local parser. Nothing was saved." } };
  }
}
