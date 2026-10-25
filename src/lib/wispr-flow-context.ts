import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Clock,
  Droplet,
  FileSearch,
  FileText,
  HeartPulse,
  Pill,
  Stethoscope,
  Upload,
} from "lucide-react";
import type { SmaranIntent } from "./nlu/intents";
import { BRAND_ASSETS } from "@/components/smaran/brand";

export const WISPR_LOGO_SRC = BRAND_ASSETS.wisprFlow;
export const WISPR_HEADING = "Ask SMARAN";
export const WISPR_TAGLINE = "Use Wispr Flow for better voice captioning.";
export const WISPR_ORGANIZE = "Speak naturally — SMARAN will organize it for you.";
export const WISPR_HELPER_TITLE = "Use Wispr Flow for better voice captioning";
export const WISPR_HELPER_BODY =
  "Use your device's Wispr Flow shortcut, dictate naturally, then review and send the text here.";
export const WISPR_POWERED = "Powered by Wispr Flow";
export const WISPR_BUTTON_LABEL = "Use Wispr Flow";

export const WISPR_SHORTCUTS = {
  windows: "Windows: Ctrl + Windows key — use the shortcut configured in the installed Wispr Flow application.",
  mac: "Mac: fn key — use the shortcut configured in the installed Wispr Flow application.",
  phone: "Phone: use Use Wispr Flow or the supported installed-device workflow. SMARAN does not record audio in the browser.",
} as const;

export type WisprSectionId = "today" | "medicines" | "appointments" | "documents" | "health-card" | "ask" | "settings";

export type WisprIntentCategory =
  | "reminder_create"
  | "today_query"
  | "medicine_write"
  | "medicine_query"
  | "appointment_write"
  | "appointment_query"
  | "document_query"
  | "document_upload"
  | "health_query"
  | "health_write"
  | "ask_query"
  | "settings_pref"
  | "blocked";

export interface WisprExampleChip {
  icon: LucideIcon;
  text: string;
}

export interface WisprSectionConfig {
  id: WisprSectionId;
  subtitle: string;
  placeholder: string;
  examples: readonly string[];
  chips: readonly WisprExampleChip[];
  allowed: readonly WisprIntentCategory[];
  emptyMessage: string;
  loadingMessage: string;
  errorMessage: string;
  showAttachment?: boolean;
  attachmentHref?: string;
}

/** Prescription/course language — not a one-off care reminder. */
export function looksLikeMedicineScheduleChange(text: string): boolean {
  const t = text.toLowerCase();
  if (/\b(yaad dila|remind|reminder|dikhao|kya hain|show|open)\b/.test(t)) return false;
  return /\b(prescribed|prescription|nuskha|dose schedule|medicine schedule|course|start (taking|the medicine)|stop (the )?medicine|pause (the )?medicine|twice daily|thrice|frequency|mg\b)\b/.test(t);
}

export function intentCategory(intent: SmaranIntent): WisprIntentCategory {
  if (intent === "medicine_reminder") return "medicine_write";
  if (intent === "health_check_reminder" || intent === "pickup_reminder") return "reminder_create";
  if (intent === "appointment_create_or_update" || intent === "appointment_complete" || intent === "appointment_cancel" || intent === "appointment_reschedule") {
    return "appointment_write";
  }
  if (intent === "health_measurement" || intent === "family_fact" || intent === "after_visit_note") return "health_write";
  if (intent === "document_question") return "document_query";
  if (intent === "ask_question") return "ask_query";
  return "blocked";
}

export const WISPR_SECTIONS: Record<WisprSectionId, WisprSectionConfig> = {
  today: {
    id: "today",
    subtitle: "Capture today's family care tasks and understand what's due.",
    placeholder: "Mummy ki dawa aaj shaam 8 baje yaad dilana.",
    examples: [
      "Mummy ki dawa aaj shaam 8 baje yaad dilana.",
      "Papa ka BP check karne ka reminder kal 9 baje lagana hai.",
      "Dadi ki appointment ke baad follow-up yaad dilana.",
    ],
    chips: [
      { icon: CalendarClock, text: "Aaj ke pending care tasks dikhao." },
      { icon: Pill, text: "Mummy ki dawa ka reminder set karo." },
      { icon: Activity, text: "Papa ka BP check yaad dilana." },
    ],
    allowed: ["reminder_create", "today_query", "ask_query"],
    emptyMessage: "Dictate or type a family-care reminder. Nothing is saved until you send and confirm.",
    loadingMessage: "Reading what you wrote…",
    errorMessage: "That was not saved. Your text is still here.",
  },
  medicines: {
    id: "medicines",
    subtitle: "Manage medicine schedules and related reminders.",
    placeholder: "Mummy ki prescribed dawa kal subah 9 baje yaad dilana.",
    examples: [
      "Mummy ki prescribed dawa kal subah 9 baje yaad dilana.",
      "Papa ki BP medicine ka current schedule dikhao.",
      "Dadi ki dawa ka refill reminder Friday ko lagana hai.",
      "Mummy ki current medicines kya hain?",
    ],
    chips: [
      { icon: Pill, text: "Mummy ki medicines kya hain?" },
      { icon: Clock, text: "Medicine ka reminder set karo." },
      { icon: Activity, text: "Papa ki dawa ka refill yaad dilana." },
    ],
    allowed: ["medicine_write", "medicine_query", "reminder_create", "ask_query"],
    emptyMessage: "Ask about saved medicines or a dose reminder. Names and doses are never invented.",
    loadingMessage: "Checking the medicine request…",
    errorMessage: "The medicine record was not changed.",
  },
  appointments: {
    id: "appointments",
    subtitle: "Schedule doctor visits and manage family follow-ups.",
    placeholder: "Mummy ki Dr Sharma ke saath Friday ko 11 baje appointment hai.",
    examples: [
      "Mummy ki Dr Sharma ke saath Friday ko 11 baje appointment hai.",
      "Papa ka cardiologist follow-up agle Monday ko 3 baje schedule karo.",
      "Dadi ki next doctor appointment kab hai?",
      "Papa ke existing appointment ka time change karna hai.",
    ],
    chips: [
      { icon: CalendarDays, text: "Mummy ki next appointment kab hai?" },
      { icon: Stethoscope, text: "Dr Sharma ki details dikhao." },
      { icon: CalendarCheck, text: "Papa ka follow-up schedule karo." },
    ],
    allowed: ["appointment_write", "appointment_query", "ask_query"],
    emptyMessage: "Describe a visit only with recorded person, doctor, date and time.",
    loadingMessage: "Checking the appointment request…",
    errorMessage: "No appointment was created or changed.",
  },
  documents: {
    id: "documents",
    subtitle: "Find and organize your family's medical documents.",
    placeholder: "Mummy ka latest blood report dikhao.",
    examples: [
      "Mummy ka latest blood report dikhao.",
      "Papa ka prescription open karo.",
      "Dadi ka discharge summary kab upload hua tha?",
      "Papa ka latest BP report search karo.",
    ],
    chips: [
      { icon: FileText, text: "Latest blood report dikhao." },
      { icon: FileSearch, text: "Papa ka prescription kholo." },
      { icon: Upload, text: "Nayi medical report upload karo." },
    ],
    allowed: ["document_query", "document_upload", "ask_query"],
    emptyMessage: "Search saved reports. SMARAN will not invent a document.",
    loadingMessage: "Searching saved documents…",
    errorMessage: "No document was invented or changed.",
    showAttachment: true,
    attachmentHref: "/documents/upload",
  },
  "health-card": {
    id: "health-card",
    subtitle: "Understand this family member's saved health history.",
    placeholder: "Mummy ka latest BP aur uski date dikhao.",
    examples: [
      "Mummy ka latest BP aur uski date dikhao.",
      "Papa ka sugar trend last 3 months ka dikhao.",
      "Dadi ki previous medical history kholo.",
      "Mummy ki last checkup details dikhao.",
    ],
    chips: [
      { icon: HeartPulse, text: "Mummy ka latest BP kitna tha?" },
      { icon: Droplet, text: "Papa ka sugar trend dikhao." },
      { icon: ClipboardList, text: "Dadi ki medical history kholo." },
    ],
    allowed: ["health_query", "health_write", "ask_query"],
    emptyMessage: "Ask about this person's saved measurements and history.",
    loadingMessage: "Reading this person's saved records…",
    errorMessage: "Nothing was added to the health card.",
  },
  ask: {
    id: "ask",
    subtitle: "Ask anything about your family's saved health information.",
    placeholder: "Mummy ka latest BP kitna tha?",
    examples: [
      "Mummy ka latest BP kitna tha?",
      "Papa ki next appointment kab hai?",
      "Dadi ki medicines kya hain?",
      "Mummy ka latest blood report kab ka hai?",
    ],
    chips: [
      { icon: HeartPulse, text: "Mummy ka latest BP kitna tha?" },
      { icon: CalendarDays, text: "Papa ki next appointment kab hai?" },
      { icon: FileText, text: "Dadi ka latest report dikhao." },
    ],
    allowed: ["ask_query", "document_query", "health_query", "medicine_query", "appointment_query", "today_query"],
    emptyMessage: "Ask from saved family records. This is not medical advice.",
    loadingMessage: "Searching authorized family records…",
    errorMessage: "I could not find that in the saved records.",
    showAttachment: true,
    attachmentHref: "/documents/upload",
  },
  settings: {
    id: "settings",
    subtitle: "Change SMARAN preferences. This box does not create medical records.",
    placeholder: "Reminder language Hindi set karo.",
    examples: ["Reminder language Hindi set karo.", "In-app notification settings kholo.", "Family member ke colour preferences dikhao."],
    chips: [
      { icon: HeartPulse, text: "Reminder language Hindi set karo." },
      { icon: Clock, text: "In-app notification settings kholo." },
      { icon: ClipboardList, text: "Family member ke colour preferences dikhao." },
    ],
    allowed: ["settings_pref"],
    emptyMessage: "Preference requests only. Medical reminders are not created here.",
    loadingMessage: "Checking the preference…",
    errorMessage: "Settings were not changed.",
  },
};

export function wisprSection(id: WisprSectionId): WisprSectionConfig {
  return WISPR_SECTIONS[id];
}

const SCHOOL_OR_CHORE = /\b(school|homework|project|grocery|gas cylinder|bijli|bill|birthday gift|train ticket|safai|office|shopping)\b/i;

export function isMedicalFamilyExample(text: string): boolean {
  return !SCHOOL_OR_CHORE.test(text);
}

export function evaluateSectionPolicy(
  section: WisprSectionId,
  intent: SmaranIntent,
  text?: string,
): { allowed: true } | { allowed: false; message: string; href?: string; hrefLabel?: string } {
  const category = intentCategory(intent);
  const config = WISPR_SECTIONS[section];
  if (section === "today" && text && looksLikeMedicineScheduleChange(text)) {
    return {
      allowed: false,
      message: "Medicine schedules are managed in Medicines.",
      href: "/medicines",
      hrefLabel: "Open Medicines",
    };
  }
  if (intent === "unknown") {
    return { allowed: false, message: "I need a clearer family-care request before I change anything." };
  }
  if (section === "today" && intent === "medicine_reminder" && text && looksLikeMedicineScheduleChange(text)) {
    return {
      allowed: false,
      message: "Medicine schedules are managed in Medicines.",
      href: "/medicines",
      hrefLabel: "Open Medicines",
    };
  }
  if (section === "today" && intent === "medicine_reminder") {
    return { allowed: true };
  }
  if (section === "today" && category === "appointment_write") {
    return {
      allowed: false,
      message: "Appointment scheduling is managed in Family Appointments.",
      href: "/appointments",
      hrefLabel: "Open Family Appointments",
    };
  }
  if (section === "today" && category === "health_write") {
    return {
      allowed: false,
      message: "Health measurements are confirmed on the Health Card.",
      href: "/family",
      hrefLabel: "Open family Health Cards",
    };
  }
  if (section === "medicines" && category === "appointment_write") {
    return {
      allowed: false,
      message: "Appointment scheduling is managed in Family Appointments.",
      href: "/appointments",
      hrefLabel: "Open Family Appointments",
    };
  }
  if (section === "appointments" && (category === "medicine_write" || (category === "reminder_create" && intent === "pickup_reminder"))) {
    return {
      allowed: false,
      message: "Medicine schedules are managed in Medicines.",
      href: "/medicines",
      hrefLabel: "Open Medicines",
    };
  }
  if (section === "documents" && (category === "appointment_write" || category === "medicine_write" || category === "health_write")) {
    return {
      allowed: false,
      message:
        category === "appointment_write"
          ? "Appointment scheduling is managed in Family Appointments."
          : category === "medicine_write"
            ? "Medicine schedules are managed in Medicines."
            : "Confirm measurements on the Health Card after you review a report.",
      href: category === "appointment_write" ? "/appointments" : category === "medicine_write" ? "/medicines" : "/family",
      hrefLabel: category === "appointment_write" ? "Open Family Appointments" : category === "medicine_write" ? "Open Medicines" : "Open Health Cards",
    };
  }
  if (section === "health-card" && (category === "appointment_write" || category === "medicine_write")) {
    return {
      allowed: false,
      message: category === "appointment_write" ? "Appointment scheduling is managed in Family Appointments." : "Medicine schedules are managed in Medicines.",
      href: category === "appointment_write" ? "/appointments" : "/medicines",
      hrefLabel: category === "appointment_write" ? "Open Family Appointments" : "Open Medicines",
    };
  }
  if (section === "ask" && (category === "appointment_write" || category === "medicine_write" || category === "health_write" || category === "reminder_create")) {
    return {
      allowed: false,
      message: "Ask SMARAN searches saved records. Open the matching section to create or change a record.",
      href:
        category === "appointment_write"
          ? "/appointments"
          : category === "reminder_create"
            ? "/today"
            : category === "medicine_write"
              ? "/medicines"
              : "/family",
      hrefLabel: "Open the right section",
    };
  }
  if (section === "settings" && category !== "settings_pref") {
    return { allowed: false, message: "Settings cannot create medical records, medicines, or appointments." };
  }
  if ((config.allowed as readonly string[]).includes(category)) {
    return { allowed: true };
  }
  if (section === "today" && category === "ask_query") {
    return { allowed: true };
  }
  return { allowed: false, message: `That request is not available in ${config.subtitle}` };
}

export function detectSettingsPreference(text: string): { field: "language" | "reminderLanguage" | "notifications"; value: string } | null {
  const t = text.toLowerCase();
  if (/\b(hindi|हिंदी)\b/.test(t) && /\b(language|bhasha|reminder)\b/.test(t)) return { field: "reminderLanguage", value: "hi" };
  if (/\b(english)\b/.test(t) && /\blanguage\b/.test(t)) return { field: "reminderLanguage", value: "en" };
  if (/\bhinglish\b/.test(t)) return { field: "reminderLanguage", value: "hinglish" };
  if (/\bnotification/.test(t)) return { field: "notifications", value: "open" };
  if (/\bcolou?r/.test(t)) return { field: "notifications", value: "colors" };
  return null;
}
