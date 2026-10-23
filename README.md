# SMARAN · स्मरण

> Your voice remembers, even when you can't be there.

SMARAN is a family health-memory prototype. You say what your parents need to remember — in Hindi, English or Hinglish — and SMARAN turns it into reminders, appointment alerts, saved health notes and a shared memory the whole family can see.

It is not a hospital system, an electronic health record, a diagnostic tool or a chatbot. It only remembers what the family tells it.

## The problem

Adult children looking after parents from another city juggle medicines, check-ups and paperwork across WhatsApp threads, phone calls and photos of prescriptions. Typing structured forms is slow, so things get missed — and when someone asks "when was Mummy's last blood report?", nobody can find it.

## How it works

**Speak → Understand → Remember → Remind → Confirm → Remember**

1. **Speak.** Type, or dictate with Wispr Flow into any SMARAN text box: *"Mummy ko roz raat 9 baje BP ki medicine yaad dilani hai."*
2. **Understand.** SMARAN pulls out who, what, when and how often, shows an "I understood" card, and asks a follow-up if something is missing.
3. **Remember.** The reminder is saved to Today, the person's Health Card and the family Memory timeline.
4. **Remind.** At the scheduled time the family member sees a gentle message: *"Mummy, medicine ka time ho gaya. 💊"*
5. **Confirm.** They reply in their own words. SMARAN answers warmly and records the confirmation with its time.
6. **Remember.** The family dashboard, Health Card and timeline update instantly.

## Wispr Flow

Wispr Flow is a system-level dictation app. It types into whichever text field has focus. SMARAN does not start Wispr Flow, detect whether it is installed, record audio, or run OCR.

- `WisprFlowInput` is a text box with idle, listening, ready and error states, using the Wispr Flow mark.
- The Wispr button focuses the box and shows a listening state. Real words arrive only if Wispr Flow (or the keyboard) types into that field.
- If nothing is typed within 12 seconds, the input shows *"We couldn't capture that. Try speaking again."*
- You can always type instead. Settings can hide Wispr prompts.

## Features

- **Today** — 7-day selector, today's reminders and appointments with live status, family status, and a Wispr capture box.
- **Natural-language capture** — reminders (daily, weekly, one-off) and appointments. Every field is editable; duplicates update the existing item and keep its history.
- **Health notes** — speak or type a measurement (*"Papa ka sugar aaj 118 tha."*). SMARAN shows a confirm card before saving. History stays on the Health Card and in Memory, and Ask SMARAN can retrieve it with a source. Incomplete BP (a single number) asks for a pair like 128/82.
- **Reminder conversation** — the chat the family member sees, with replies for confirm, snooze, out of stock and feeling unwell. Unclear replies get a follow-up, never medical advice. Suggested reply chips are optional; nothing is auto-typed.
- **Family dashboard** — each person's day at a glance, add and edit family members.
- **Appointments** — upcoming, later and completed; reminder offsets you can toggle or add; attach documents.
- **Document vault** — upload a PDF or photo (or a fictional sample file), describe it, search by name/type/person, link it to an appointment, preview it. No OCR.
- **Health Card** — one card per person with measurements, upcoming visits, medicines, confirmations and documents, plus a print-friendly share page (`/share/health-card/:id`).
- **Ask SMARAN** — questions like *"Mummy ka latest blood report kab ka hai?"* or *"Mummy ka BP kya tha?"* answered only from saved data, with links to the source. Dose and symptom questions are redirected to the doctor.
- **Memory timeline** — everything that happened, including health note changes, filterable by person and kind.
- **Settings** — profile, family, English/हिन्दी navigation, reminder sound, Wispr Flow toggle, notifications, JSON export, privacy notes, restore sample family, clear all data.
- **Onboarding** — welcome plus four steps, including a live Wispr parsing example and family setup.
- **Responsive layout** — one app, no Mobile/Web toggle and no phone frame. Screens below 1024px use the mobile chrome (header + bottom nav); larger screens use the sidebar.

The app ships with a fictional sample family (Mummy and Papa) so you can try Ask and Health Card immediately. Sample measurements are labelled as family notes, not clinical readings.

## Data and privacy

There is no backend, account or network call for family data.

- App state lives in `localStorage` (`smaran:state`) and syncs across tabs.
- Uploaded files are stored in the browser's IndexedDB (`smaran-files`) and never leave the device.
- SMARAN does **not** read file contents (no OCR). Document details come from the file name, your description, or what you type.
- All preloaded people, reminders, appointments, documents and health notes are fictional. Sample documents are watermarked and show no clinical values.

Please only use fictional details in this prototype.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Cache Components) with TypeScript
- Tailwind CSS v4 with a warm design-token palette (ivory `#FDEEE6`, peach `#E8A98D`, sand `#F6DCC8`, terracotta `#D4A373`, brown `#8B6F5E`)
- [shadcn/ui](https://ui.shadcn.com) primitives on Base UI, lucide icons, Sonner toasts
- Nunito and Noto Sans Devanagari via `next/font`
- A small rule-based Hinglish/English parser in `src/lib/nlu` — deterministic, local, no AI service or API key

## Run it locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev -- -p 43117
```

Open <http://localhost:43117>. No environment variables are needed.

Other scripts:

```bash
npm run lint     # ESLint
npx tsc --noEmit # typecheck
npm run build    # production build
npm run start    # serve the production build
```

## Deploy

The app is a standard Next.js project with no server-side secrets, so it deploys to Vercel as-is: import the repository in Vercel, keep the detected Next.js settings, and deploy. No environment variables are required.

## Try the sample family

The family clock in this prototype starts on Friday, October 23, 2026 at 10:30 AM. Sending a reminder moves that clock to the reminder's scheduled time so confirmation times stay consistent.

1. Open `/welcome` and step through onboarding, or go straight to `/today`.
2. On **Today**, type or dictate *"Mummy ko roz raat 9 baje BP ki medicine yaad dilani hai."*
3. Review the **I understood** card and create the reminder.
4. Open the reminder and send *"Haan, maine le li."* from the chat (or tap a suggested reply).
5. See the confirmation on Today, Family and Mummy's Health Card.
6. Save a health note: *"Mummy ka BP 128/82 save karo"* or *"Papa ki sugar 142"*.
7. Create the appointment: *"Mummy ka Dr Sharma ke saath Friday ko 11 baje appointment hai. Teen din pehle yaad dila dena."*
8. Upload a report (or the fictional sample) and attach it to the appointment. Search documents for “blood” or “sugar”.
9. Ask *"Mummy ka latest blood report kab ka hai?"* and *"Mummy ka BP kya tha?"*

## Brand assets

`public/brand/smaran-mark.svg` and `public/brand/wispr-flow.svg` are placeholders. Replace them with the official files at the same paths (see `BRAND_ASSETS` in `src/components/smaran/brand.tsx`).

## Limitations

- Reminders are not delivered to a real phone. The family member's side is simulated in the reminder chat.
- Wispr Flow is dictation-into-textbox only. SMARAN cannot trigger it from the browser and does not transcribe audio itself.
- The language parser is rule-based. It handles common Hindi, English and Hinglish phrasing for people, times, days, doctors, reminder offsets and BP/sugar/weight notes, and asks when it isn't sure.
- No OCR or document understanding. No medical advice, ever.
- Data is per-browser. A shared Health Card link only opens on the device holding the data; use Print → Save as PDF to share it elsewhere.
