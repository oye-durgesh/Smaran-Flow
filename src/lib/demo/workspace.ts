import type { AppState, FamilyMember } from "@/lib/types";

export const DEMO_FAMILY_NAME = "SMARAN Demo Family";
export const DEMO_SEED_VERSION = 1;
export const DEMO_BANNER = "DEMO WORKSPACE — All family health records shown here are fictional.";
export const DEMO_RECORD_LABEL = "Sample demo record";
export const DEMO_LOAD_CONFIRM =
  "This creates fictional sample medical and appointment records in a separate SMARAN Demo Family. It will not modify your real family data.";
export const DEMO_RESET_CONFIRM =
  "This deletes only records in SMARAN Demo Family (four fictional people, medicines, appointments, measurements, documents, diary, vaccinations, and reminders). Your real family is not touched. Membership is kept.";

export interface WorkspaceInfo {
  id: string;
  name: string;
  isDemo: boolean;
  role: string;
  seedVersion: number | null;
  referenceDate: string | null;
}

export function isDemoWorkspace(info?: Pick<WorkspaceInfo, "isDemo"> | null): boolean {
  return Boolean(info?.isDemo);
}

export function resolveActiveFamily(
  workspaces: WorkspaceInfo[],
  preferredId: string | null,
): WorkspaceInfo | null {
  if (!workspaces.length) return null;
  const preferred = preferredId ? workspaces.find((w) => w.id === preferredId) : undefined;
  if (preferred) return preferred;
  return workspaces.find((w) => !w.isDemo) ?? workspaces[0];
}

export function isolateState(state: AppState, demo: boolean): AppState {
  if (demo) return state;
  return {
    ...state,
    reminders: state.reminders.filter((r) => r.source !== "sample"),
    appointments: state.appointments.filter((a) => a.source !== "sample"),
    documents: state.documents.filter((d) => d.metadata.source !== "sample"),
    measurements: state.measurements.filter((m) => m.source !== "sample"),
    medicines: state.medicines.filter((m) => !m.notes?.includes("Sample demo record")),
    doctors: state.doctors.filter((d) => d.source !== "sample"),
    medicalHistory: state.medicalHistory.filter((h) => h.source !== "sample"),
    vaccinations: state.vaccinations.filter((v) => v.source !== "sample"),
    diary: state.diary.filter((d) => d.source !== "sample"),
    memory: state.memory.filter((m) => m.source !== "sample"),
    inAppNotifications: (state.inAppNotifications ?? []).filter((n) => !n.id.startsWith("demo-")),
  };
}

export function chartsUsePersistedOnly(liveCount: number, fallbackCount: number, demoWorkspace: boolean): number {
  if (liveCount > 0) return liveCount;
  if (demoWorkspace) return 0;
  return 0 + fallbackCount * 0;
}

export function memberKeys(family: FamilyMember[]): string[] {
  return family.map((m) => m.name);
}
