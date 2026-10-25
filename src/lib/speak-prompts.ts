export type SpeakContext = "general" | "ask" | "documents" | "appointments" | "family" | "memory" | { person: string };

export const SPEAK_PROMPTS = {
  general: [
    "Mummy ki dawa aaj shaam 8 baje yaad dilana.",
    "Papa ka BP check karne ka reminder kal 9 baje lagana hai.",
    "Dadi ki appointment ke baad follow-up yaad dilana.",
  ],
  family: [
    "Mummy ki age 58 hai.",
    "Papa ki age 62 hai.",
    "Mummy ki medicine ka time 9 baje kar do.",
    "Papa ki medicine ka time change karke 8 baje kar do.",
    "Papa ka sugar reading update kar do.",
    "Mummy ke health card mein BP reading save kar do.",
    "Papa ka doctor ka appointment kal 11 baje hai.",
  ],
  appointments: [
    "Mummy ki next appointment kab hai?",
    "Papa ka follow-up kal schedule karna hai.",
    "Dadi ki doctor list dikhao.",
  ],
  documents: [
    "Mummy ka latest blood report dikhao.",
    "Papa ka ECG report dikhao.",
    "Mummy ki prescription dikhao.",
    "Mummy ki sugar wali report dikhao.",
    "Papa ke latest documents dikhao.",
    "Mummy ka October wala report dikhao.",
    "BP wali report find karo.",
  ],
  memory: [
    "Aaj kya kya hua tha?",
    "Aaj Mummy ne kaunsi medicine confirm ki?",
    "Papa ne medicine kab li thi?",
    "Mummy ke baare mein SMARAN ko kya yaad hai?",
    "Aaj ka family memory dikhao.",
    "Mummy ka latest update kya hai?",
  ],
  ask: [
    "Mummy ka latest sugar level kya hai?",
    "Mummy ka BP kitna tha?",
    "Papa ka latest BP kya hai?",
    "Mummy ki next appointment kab hai?",
    "Mummy ki medicines kya hain?",
    "Mummy ka latest blood report kaunsa hai?",
    "Papa ka ECG report kab ka hai?",
    "Mummy ka BP history dikhao.",
  ],
  health: [
    "Mummy ka BP 128 over 82 tha, save kar do.",
    "Mummy ka sugar 104 tha, health card mein daal do.",
    "Papa ka BP 130 over 85 hai.",
    "Papa ka aaj sugar 110 hai, record kar lo.",
    "Mummy ki latest BP reading dikhao.",
    "Papa ki latest sugar reading kya hai?",
    "Mummy ka BP history dikhao.",
  ],
} as const;

export function promptsFor(ctx: SpeakContext): readonly string[] {
  if (ctx === "ask") return SPEAK_PROMPTS.ask;
  if (ctx === "documents") return SPEAK_PROMPTS.documents;
  if (ctx === "appointments") return SPEAK_PROMPTS.appointments;
  if (ctx === "family") return SPEAK_PROMPTS.family;
  if (ctx === "memory") return SPEAK_PROMPTS.memory;
  if (typeof ctx === "object") return SPEAK_PROMPTS.health;
  return SPEAK_PROMPTS.general;
}

const HELPER = "Speak naturally — SMARAN will organize it for you.";

export function speakCopy(ctx: SpeakContext): { placeholder: string; helper: string } {
  if (ctx === "ask") return { placeholder: "Ask SMARAN about your family…", helper: HELPER };
  if (ctx === "documents") return { placeholder: "Tell SMARAN what document you're looking for…", helper: HELPER };
  if (ctx === "appointments") return { placeholder: "Tell SMARAN about an appointment…", helper: HELPER };
  if (ctx === "family") return { placeholder: "Tell SMARAN something about Mummy or Papa…", helper: HELPER };
  if (ctx === "memory") return { placeholder: "Tell SMARAN something you want to remember…", helper: HELPER };
  if (typeof ctx === "object") return { placeholder: `Tell SMARAN what you want to update about ${ctx.person}…`, helper: HELPER };
  return { placeholder: "Tell SMARAN what your family needs to remember…", helper: HELPER };
}
