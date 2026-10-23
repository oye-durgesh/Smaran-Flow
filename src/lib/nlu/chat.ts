import type { ConversationOutcome, ReminderKind } from "../types";
import { normalize } from "./common";

export type ReplyIntent = "confirm" | "snooze" | "decline" | "out_of_stock" | "unwell" | "unknown";

export function classifyReply(text: string): ReplyIntent {
  const t = normalize(text);
  if (/\b(chakkar|dard|pain|dizzy|ulti|vomit|bimar|sick|bukhar|fever|ghabrahat|saans|breath|theek nahi|tabiyat)\b/.test(t)) return "unwell";
  if (/\b(khatam|finished|ran out|run out|out of stock|nahi bachi|nahi hai ghar|khtm)\b/.test(t)) return "out_of_stock";
  if (/\b(baad mein|baad me|thodi der|thoda ruk|later|minute|minutes|mins|remind me later|abhi leti|abhi lungi|abhi leta|abhi lunga)\b/.test(t)) return "snooze";
  const negative = /\b(nahi|nahin|nhi|na|no|not yet|abhi nahi|bhool)\b/.test(t);
  const positive = /\b(haan|haa|han|ha|ji|yes|yep|yeah|done|ok|okay|ho gaya|ho gayi|le li|le liya|li hai|liya|kha li|kha liya|khaa li|taken|took|maine li|kar liya|kar li|check kiya|kar diya|confirmed)\b/.test(t);
  if (positive && !negative) return "confirm";
  if (negative) return "decline";
  return "unknown";
}

export function openingMessage(name: string, title: string, kind: ReminderKind): string {
  if (kind === "medicine") return `${name}, medicine ka time ho gaya. 💊`;
  return `${name}, ${title} ka time ho gaya.`;
}

export interface ReplyPlan {
  intent: ReplyIntent;
  response: string;
  outcome?: ConversationOutcome;
}

export function planReply(text: string, memberName: string, caregiverName: string, title: string, kind: ReminderKind): ReplyPlan {
  const intent = classifyReply(text);
  switch (intent) {
    case "confirm":
      return {
        intent,
        outcome: "confirmed",
        response: kind === "medicine" ? `Theek hai, ${memberName}. Ab rest kar lo. Main yahin hoon.` : `Theek hai, ${memberName}. Maine note kar liya. Main yahin hoon.`,
      };
    case "snooze":
      return { intent, outcome: "snoozed", response: `Koi baat nahi, ${memberName}. Main 15 minute mein phir yaad dilaungi.` };
    case "decline":
      return { intent, outcome: "declined", response: `Koi baat nahi. Jab ho jaaye, bas mujhe bata dena. Main ${caregiverName} ko bhi bata deti hoon.` };
    case "out_of_stock":
      return { intent, outcome: "flagged", response: `Samajh gayi. Main ${caregiverName} ko abhi bata rahi hoon ki ${title} khatam ho gayi hai.` };
    case "unwell":
      return {
        intent,
        outcome: "flagged",
        response: `Main ${caregiverName} ko abhi bata rahi hoon. Agar takleef badhe, toh doctor se zaroor baat karna.`,
      };
    default:
      return {
        intent,
        response: kind === "medicine" ? `Maaf karna, main samajh nahi paayi. Kya aapne ${title} le li?` : `Maaf karna, main samajh nahi paayi. Kya ${title} ho gaya?`,
      };
  }
}
