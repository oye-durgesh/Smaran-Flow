import "server-only";
import type { AppState } from "@/lib/types";
import { backendConfigured } from "./env";
import type { DeviceSession } from "./session";
import { createUserClient } from "./supabase";
import { loadVault, VaultError } from "./vault";

export interface AuthorizedSnapshot {
  persistence: "supabase" | "device-local";
  authorization: "family-scoped" | "device-local-unauthenticated";
  family: { id: string; name: string }[];
  appointments: AppState["appointments"];
  reminders: AppState["reminders"];
  measurements: AppState["measurements"];
  documents: AppState["documents"];
  medicines: AppState["medicines"];
  medicalHistory: AppState["medicalHistory"];
}

const EMPTY: AuthorizedSnapshot = {
  persistence: "device-local",
  authorization: "device-local-unauthenticated",
  family: [],
  appointments: [],
  reminders: [],
  measurements: [],
  documents: [],
  medicines: [],
  medicalHistory: [],
};

export async function loadAuthorizedFamily(session: DeviceSession): Promise<AuthorizedSnapshot> {
  if (!backendConfigured() || session.mode === "device-local" || !session.authenticated || !session.userId) {
    return {
      ...EMPTY,
      persistence: backendConfigured() ? "supabase" : "device-local",
      authorization: session.authenticated ? "family-scoped" : "device-local-unauthenticated",
    };
  }
  if (!session.familyId) return { ...EMPTY, persistence: "supabase", authorization: "family-scoped" };
  try {
    const supabase = await createUserClient();
    const vault = await loadVault(supabase, session.familyId);
    return {
      persistence: "supabase",
      authorization: "family-scoped",
      family: vault.family.map((m) => ({ id: m.id, name: m.name })),
      appointments: vault.appointments,
      reminders: vault.reminders,
      measurements: vault.measurements,
      documents: vault.documents,
      medicines: vault.medicines,
      medicalHistory: vault.medicalHistory,
    };
  } catch (e) {
    if (e instanceof VaultError) throw e;
    throw new VaultError("Family vault read failed.", 500);
  }
}

export function namesOnlyFamily(names: string[]): AuthorizedSnapshot["family"] {
  return names.slice(0, 20).map((name, i) => ({ id: `hint-${i}`, name }));
}
