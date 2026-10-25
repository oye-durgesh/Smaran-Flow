import { createEmptyState } from "./seed";
import type { AppState } from "./types";

/** Build a retrieval snapshot from authorized vault rows. Never mixes demo fixtures. */
export function snapshotFromVault(partial: Partial<AppState> & { family?: AppState["family"] }): AppState {
  const empty = createEmptyState();
  return {
    ...empty,
    family: partial.family ?? [],
    appointments: partial.appointments ?? [],
    reminders: partial.reminders ?? [],
    measurements: partial.measurements ?? [],
    documents: partial.documents ?? [],
    medicines: partial.medicines ?? [],
    medicalHistory: partial.medicalHistory ?? [],
    vaccinations: partial.vaccinations ?? [],
    diary: partial.diary ?? [],
    memory: partial.memory ?? [],
    refills: partial.refills ?? [],
    doctors: partial.doctors ?? [],
  };
}
