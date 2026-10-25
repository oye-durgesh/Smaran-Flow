"use client";

import { useAppState } from "./store/store";
import type { Language } from "./types";

const STRINGS = {
  today: { en: "Today", hi: "आज" },
  family: { en: "Family", hi: "परिवार" },
  medicines: { en: "Medicines", hi: "दवाइयाँ" },
  appointments: { en: "Family Appointments", hi: "परिवार के अपॉइंटमेंट" },
  documents: { en: "Documents", hi: "दस्तावेज़" },
  memory: { en: "Memory", hi: "स्मृति" },
  ask: { en: "Ask SMARAN", hi: "SMARAN से पूछें" },
  settings: { en: "Settings", hi: "सेटिंग्स" },
  aboutMe: { en: "About Me", hi: "मेरे बारे में" },
  healthCards: { en: "Health Cards", hi: "हेल्थ कार्ड" },
  mainNav: { en: "Main navigation", hi: "मुख्य नेविगेशन" },
  "Good morning": { en: "Good morning", hi: "सुप्रभात" },
  "Good afternoon": { en: "Good afternoon", hi: "नमस्ते" },
  "Good evening": { en: "Good evening", hi: "शुभ संध्या" },
  todaySubtitle: { en: "Here's what your family needs to remember today.", hi: "आज आपके परिवार को ये याद रखना है।" },
  todaysMemory: { en: "Today's Schedule", hi: "आज का कार्यक्रम" },
  todaysSchedule: { en: "Today's Schedule", hi: "आज का कार्यक्रम" },
  dayMemory: { en: "Memory for", hi: "याद —" },
  wisprPrompt: { en: "Tell SMARAN what your family needs to remember...", hi: "SMARAN को बताइए कि परिवार को क्या याद रखना है..." },
  upcoming: { en: "Upcoming", hi: "आने वाले" },
  familyStatus: { en: "Family today", hi: "आज परिवार" },
} satisfies Record<string, Record<Language, string>>;

export type StringKey = keyof typeof STRINGS;

export function translate(key: StringKey, lang: Language): string {
  return STRINGS[key][lang];
}

export function useT() {
  const lang = useAppState().settings.language;
  return (key: StringKey) => translate(key, lang);
}
