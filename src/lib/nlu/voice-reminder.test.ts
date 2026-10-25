import { describe, expect, it } from "vitest";
import { interpretLocally } from "./intents";
import { captureOnToday } from "../store/today-capture";
import { withTestRecipients } from "../seed";
import { DEMO_FAMILY_NAME } from "../demo/workspace";
import { buildDemoDataset, datasetAsAppState } from "../demo/seed-dataset";

const now = { date: "2026-10-25", time: "14:00", weekday: 0, timestamp: "2026-10-25T14:00", timezone: "Asia/Kolkata" };
const family = withTestRecipients().family;

describe("Hinglish voice-to-reminder parsing", () => {
  it("parses Mummy sugar medicine daily at 9 PM", () => {
    const text = "Mummy ko sugar ki dawa roz raat 9 baje yaad dilana.";
    const draft = interpretLocally(text, { family, appointments: [] }, "general_reminder", now);
    expect(draft.intent).toBe("medicine_reminder");
    expect(draft.memberId).toBe("mummy");
    expect(draft.memberName).toBe("Mummy");
    expect(draft.time).toBe("21:00");
    expect(draft.frequency).toBe("daily");
    expect(draft.title?.toLowerCase()).toBe("sugar medicine");
    expect(draft.timezone).toBe("Asia/Kolkata");
  });

  it("accepts English and Hinglish equivalents without flipping AM/PM", () => {
    const phrases = [
      "Mummy ki sugar medicine daily at 9 PM remind karna.",
      "Remind me every day at 9 pm that Mummy needs her sugar medicine.",
      "Mother ke liye sugar medicine ka reminder har roz raat 9 baje lagao.",
    ];
    for (const text of phrases) {
      const draft = interpretLocally(text, { family, appointments: [] }, "general_reminder", now);
      expect(draft.memberId, text).toBe("mummy");
      expect(draft.time, text).toBe("21:00");
      expect(draft.frequency, text).toBe("daily");
    }
  });

  it("maps Papa, Dadi, and Dada Ji aliases", () => {
    const papa = interpretLocally("Papa ko BP check karne ke liye roz subah 8 baje yaad dilana.", { family, appointments: [] }, undefined, now);
    expect(papa.intent).toBe("health_check_reminder");
    expect(papa.memberId).toBe("papa");
    expect(papa.time).toBe("08:00");
    expect(papa.frequency).toBe("daily");

    const dadi = interpretLocally("Dadi ki dawai har shaam 7 baje yaad dilana.", { family, appointments: [] }, undefined, now);
    expect(dadi.intent).toBe("medicine_reminder");
    expect(dadi.memberId).toBe("dadi");
    expect(dadi.time).toBe("19:00");
    expect(dadi.frequency).toBe("daily");

    const dada = interpretLocally("Dada Ji ko har din raat 9 baje BP check yaad dilana.", { family, appointments: [] }, undefined, now);
    expect(dada.intent).toBe("health_check_reminder");
    expect(dada.memberId).toBe("dada");
    expect(dada.time).toBe("21:00");
    expect(dada.frequency).toBe("daily");
  });

  it("asks for clarification instead of inventing a member or time", () => {
    const unclear = interpretLocally("Dawa yaad dilana.", { family, appointments: [] }, undefined, now);
    expect(unclear.clarificationQuestion).toBeTruthy();
    expect(unclear.memberId).toBeUndefined();
  });

  it("creates a persisted daily reminder in the isolated demo workspace", () => {
    const state = datasetAsAppState(buildDemoDataset("2026-10-25"));
    expect(state.settings.demoWorkspace).toBe(true);
    const first = captureOnToday(state, "Mummy ko sugar ki dawa roz raat 9 baje yaad dilana.");
    const created = first.result;
    if (!created.ok) throw new Error(created.error);
    expect(created.recipientId).toBe("mummy");
    expect(created.time).toBe("21:00");
    expect(created.recurrence).toBe("daily");
    const saved = first.next.reminders.find((r) => r.id === created.id);
    expect(saved?.title.toLowerCase()).toBe("sugar medicine");
    expect(saved?.frequency).toBe("daily");
    const again = captureOnToday(first.next, "Mummy ko sugar ki dawa roz raat 9 baje yaad dilana.");
    if (again.result.ok !== true) throw new Error(again.result.error);
    expect(again.result.merged).toBe(true);
    expect(again.next.reminders.filter((r) => r.title.toLowerCase() === "sugar medicine" && r.familyMemberId === "mummy")).toHaveLength(1);
    expect(DEMO_FAMILY_NAME).toBe("SMARAN Demo Family");
  });
});
