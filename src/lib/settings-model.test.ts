import { describe, expect, it } from "vitest";
import { createEmptyState } from "./seed";
import { addMember, updateMember } from "./store/actions";
import { familySwatch } from "./family-color";
import {
  SETTINGS_GROUPS,
  SETTINGS_LAYOUT,
  SETTINGS_SUBTITLE,
  applySettings,
  familyInviteAvailable,
  inAppNotificationPolicy,
  notificationPermissionLabel,
  sampleSettingsIsolation,
  sessionStatusLabel,
  settingsRecordCounts,
  speechOutputAvailable,
} from "./settings-model";

describe("settings dashboard", () => {
  it("declares the required groups and a two-column overflow-safe layout", () => {
    expect(SETTINGS_GROUPS).toEqual(["profile", "family", "voice", "notifications", "account", "data", "about"]);
    expect(SETTINGS_LAYOUT.desktop).toContain("lg:grid-cols-2");
    expect(SETTINGS_LAYOUT.desktop).toContain("overflow-x-hidden");
    expect(SETTINGS_LAYOUT.mobile).toBe("grid-cols-1");
    expect(SETTINGS_SUBTITLE).toMatch(/preferences/);
  });

  it("adds a family member without inventing medical history", () => {
    const [next, id] = addMember(createEmptyState(), { name: "Riya", relationship: "Other", age: 16, colorKey: "sand" });
    expect(next.family.filter((m) => m.id === id)).toHaveLength(1);
    expect(next.family.find((m) => m.id === id)?.name).toBe("Riya");
    expect(next.measurements.filter((m) => m.familyMemberId === id)).toHaveLength(0);
    expect(next.appointments.filter((a) => a.familyMemberId === id)).toHaveLength(0);
    expect(next.medicines.filter((m) => m.familyMemberId === id)).toHaveLength(0);
  });

  it("edits a member in place and persists identity colour", () => {
    const [added, id] = addMember(createEmptyState(), { name: "Riya", relationship: "Other", colorKey: "sand" });
    const renamed = updateMember(added, id, { name: "Riya Sharma", colorKey: "clay" });
    expect(renamed.family.filter((m) => m.id === id)).toHaveLength(1);
    expect(renamed.family.find((m) => m.id === id)?.name).toBe("Riya Sharma");
    expect(renamed.settings.memberColors[id]).toBe("clay");
    expect(familySwatch(renamed.family.find((m) => m.id === id)).primary).toBe("#C07A5A");
  });

  it("describes session and notification truthfully", () => {
    expect(sessionStatusLabel({ authenticated: true, configured: true })).toBe("Signed-in family vault");
    expect(sessionStatusLabel({ authenticated: false, configured: true })).toBe("Authentication required");
    expect(sessionStatusLabel({ authenticated: false, configured: false })).toBe("Device-local mode");
    expect(notificationPermissionLabel("denied")).toMatch(/denied/);
    expect(notificationPermissionLabel("unsupported")).toMatch(/does not support/);
    expect(speechOutputAvailable()).toBe(false);
    expect(familyInviteAvailable()).toBe(false);
    expect(inAppNotificationPolicy()).toEqual({
      bannersOptional: true,
      persistWhenBannersOff: true,
      soundImplemented: false,
      browserPushRequested: false,
      outboundChannels: [],
    });
  });

  it("persists language and rejects an unsupported value without claiming success", () => {
    const ok = applySettings(createEmptyState(), { language: "hi" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.state.settings.language).toBe("hi");
    const fail = applySettings(createEmptyState(), { language: "fr" as never });
    expect(fail.ok).toBe(false);
  });

  it("keeps sample preview isolated and counts real saved rows", () => {
    expect(sampleSettingsIsolation()).toEqual({ writesAppointments: false, writesReminders: false, writesSupabase: false, silentVaultInsert: false });
    const empty = settingsRecordCounts(createEmptyState());
    expect(empty.recipients).toBe(0);
    expect(empty.documents).toBe(0);
    expect(empty.medicines).toBe(0);
    expect(empty.appointments).toBe(0);
  });
});
