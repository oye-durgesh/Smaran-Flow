import type { AppState, ReminderLanguage, Settings } from "./types";
import type { SessionPayload } from "./store/cloud";
import { updateSettings } from "./store/actions";
import { fixturesNeverWriteVault } from "./demo/appointment-fixtures";

export const SETTINGS_SUBTITLE = "Your family, your preferences, your data.";

export const SETTINGS_GROUPS = [
  "profile",
  "family",
  "voice",
  "notifications",
  "account",
  "data",
  "about",
] as const;

export const SETTINGS_LAYOUT = {
  desktop: "lg:grid-cols-2 overflow-x-hidden",
  mobile: "grid-cols-1",
};

export const WISPR_SETTINGS_HELP =
  "Use Wispr Flow for better speech-to-text. Dictate naturally into the focused SMARAN input, review the text, and send it.";

export function sessionStatusLabel(session: Pick<SessionPayload, "authenticated" | "configured">): string {
  if (session.authenticated) return "Signed-in family vault";
  if (session.configured) return "Authentication required";
  return "Device-local mode";
}

export function notificationPermissionLabel(permission: NotificationPermission | "unsupported"): string {
  if (permission === "unsupported") return "This browser does not support notification permission.";
  if (permission === "granted") return "Browser permission granted. This is not proof of server or phone delivery.";
  if (permission === "denied") return "Browser permission denied. Re-enable it in the browser settings. Server push is not configured.";
  return "Browser permission not requested. In-app banners can still appear. Server delivery is not configured.";
}

export function speechOutputAvailable(): false {
  return false;
}

export function familyInviteAvailable(): false {
  return false;
}

export function settingsRecordCounts(state: AppState) {
  return {
    recipients: state.family.length,
    documents: state.documents.filter((d) => d.metadata?.source !== "sample").length,
    appointments: state.appointments.filter((a) => a.source !== "sample").length,
    measurements: state.measurements.filter((m) => m.source !== "sample").length,
    medicines: state.medicines.length,
  };
}

export function applySettings(state: AppState, patch: Partial<Settings>): { ok: true; state: AppState } | { ok: false; error: string } {
  if (patch.language && patch.language !== "en" && patch.language !== "hi") {
    return { ok: false, error: "That language is not supported." };
  }
  return { ok: true, state: updateSettings(state, patch) };
}

export function reminderLanguageLabel(value: ReminderLanguage): string {
  if (value === "hi") return "Hindi";
  if (value === "hinglish") return "Hinglish";
  return "English";
}

export function sampleSettingsIsolation() {
  return { ...fixturesNeverWriteVault(), silentVaultInsert: false as const };
}
