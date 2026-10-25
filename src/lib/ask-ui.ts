import type { LucideIcon } from "lucide-react";
import { CalendarDays, ClipboardList, Droplet, FileImage, FileText, HeartPulse, Pill, ShieldCheck } from "lucide-react";

export const ASK_SUBTITLE = "Ask anything about your family's health, appointments, medicines, reports and more.";
export const ASK_PLACEHOLDER = "Ask anything about your family's health…";
export const WISPR_FOCUS_HINT = "Use Wispr Flow for voice typing. It types into this box. SMARAN does not record the microphone in the browser.";
export const MISSING_RECORD = "I couldn't find that information in your family's saved records.";

export interface AskSuggestion {
  question: string;
  subtitle: string;
  icon: LucideIcon;
  tint: string;
  href?: string;
}

export const ASK_SUGGESTIONS: AskSuggestion[] = [
  { question: "Mummy ka latest BP kitna tha?", subtitle: "Check latest BP with trend", icon: HeartPulse, tint: "bg-[#FCE8E1] text-[#8F4538]" },
  { question: "Papa ka sugar kitna tha?", subtitle: "Get latest sugar reading", icon: Droplet, tint: "bg-[#E7F0E6] text-[#3F6B45]" },
  { question: "Mummy ki next appointment kab hai?", subtitle: "See upcoming appointments", icon: CalendarDays, tint: "bg-[#EDE7F2] text-[#5E4B72]" },
  { question: "Dadi ki medicines kya hain?", subtitle: "View today's medicines", icon: Pill, tint: "bg-[#F8E4D8] text-[#8F4538]" },
  { question: "Mummy ka latest blood report dikhao.", subtitle: "Find reports and documents", icon: FileText, tint: "bg-[#F8EBD5] text-[#80551F]" },
  { question: "Papa ki vaccination history dikhao.", subtitle: "View vaccination records", icon: ShieldCheck, tint: "bg-[#E7F0E6] text-[#3F6B45]" },
  { question: "Mummy ka medical history kya hai?", subtitle: "See past illnesses, surgeries and more", icon: ClipboardList, tint: "bg-[#F5E3DC] text-[#78483D]" },
  { question: "Upload karke yeh report save karo.", subtitle: "Add and organize a new document", icon: FileImage, tint: "bg-[#F8EBD5] text-[#80551F]", href: "/documents/upload" },
];

export function greetingText(name: string) {
  return `Hi ${name || "there"}! 👋\n\nI'm SMARAN. I can find information from your family's records — medicines, appointments, reports, documents and more.\n\nWhose information would you like to check?`;
}

export function askLayoutContract() {
  return {
    desktop: "lg:grid-cols-[minmax(0,1fr)_320px] overflow-x-hidden",
    chat: "flex min-h-0 flex-1 flex-col",
    mobileSuggestions: "lg:hidden",
    composer: "sticky bottom-0",
  };
}

export function handleComposerKey(event: { key: string; shiftKey: boolean; isComposing?: boolean }): "submit" | "newline" | "ignore" {
  if (event.key !== "Enter") return "ignore";
  if (event.isComposing) return "ignore";
  return event.shiftKey ? "newline" : "submit";
}

export function sameAskRoute(): "/api/ask" {
  return "/api/ask";
}
