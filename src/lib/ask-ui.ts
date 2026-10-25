import type { LucideIcon } from "lucide-react";
import { CalendarDays, ClipboardList, Droplet, FileImage, FileText, HeartPulse, Pill, ShieldCheck } from "lucide-react";

export const ASK_SUBTITLE = "Ask anything about your family's saved health information.";
export const ASK_PLACEHOLDER = "Mummy ka latest BP kitna tha?";
export { WISPR_HEADING, WISPR_ORGANIZE as WISPR_SUPPORT, WISPR_HELPER_BODY as WISPR_FOCUS_HINT } from "./wispr-flow-context";
export const MISSING_RECORD = "I couldn't find that information in your family's saved records.";

export interface AskSuggestion {
  question: string;
  subtitle: string;
  icon: LucideIcon;
  tint: string;
  href?: string;
}

export const ASK_SUGGESTIONS: AskSuggestion[] = [
  { question: "Mummy ka latest BP kya hai?", subtitle: "Check latest BP with trend", icon: HeartPulse, tint: "bg-[#FCE8E1] text-[#8F4538]" },
  { question: "Show the last 10 BP readings for Mummy.", subtitle: "List stored BP readings", icon: HeartPulse, tint: "bg-[#FCE8E1] text-[#8F4538]" },
  { question: "Papa ki latest sugar reading dikhao.", subtitle: "Get latest sugar reading", icon: Droplet, tint: "bg-[#E7F0E6] text-[#3F6B45]" },
  { question: "Papa ki next appointment kab hai?", subtitle: "See upcoming appointments", icon: CalendarDays, tint: "bg-[#EDE7F2] text-[#5E4B72]" },
  { question: "Dadi ki current medicines kya hain?", subtitle: "View today's medicines", icon: Pill, tint: "bg-[#F8E4D8] text-[#8F4538]" },
  { question: "Dada Ji ka BP trend dikhao.", subtitle: "Open Dada Ji BP history", icon: HeartPulse, tint: "bg-[#F5E3DC] text-[#78483D]" },
  { question: "Kiski medicine refill hone wali hai?", subtitle: "Find refill reminders", icon: Pill, tint: "bg-[#F8E4D8] text-[#8F4538]" },
  { question: "Aaj sabki care tasks kya hain?", subtitle: "Today's family care tasks", icon: ClipboardList, tint: "bg-[#F5E3DC] text-[#78483D]" },
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
