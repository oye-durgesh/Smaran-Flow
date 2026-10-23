# SMARAN · स्मरण

> Your voice remembers, even when you can't be there.

SMARAN is an interactive prototype of a family health-memory app. You say what your parents need to remember — in Hindi, English or Hinglish, the way you'd say it to family — and SMARAN turns it into reminders, appointment alerts and a shared memory that the whole family can see.

It is not a hospital system, an electronic health record, a diagnostic tool or a chatbot. It only remembers what the family tells it.

## The problem

Adult children looking after parents from another city juggle medicines, check-ups and paperwork across WhatsApp threads, phone calls and photos of prescriptions. Typing structured forms is slow, so things get missed — and when someone asks "when was Mummy's last blood report?", nobody can find it.

## How it works

**Speak → Understand → Remember → Remind → Confirm → Remember**

1. **Speak.** Dictate into any SMARAN text box with Wispr Flow: *"Mummy ko roz raat 9 baje BP ki medicine yaad dilani hai."*
2. **Understand.** SMARAN pulls out who, what, when and how often, shows an "I understood" card, and asks a follow-up if something is missing.
3. **Remember.** The reminder is saved to Today, the person's Health Card and the family Memory timeline.
4. **Remind.** At the scheduled time Mummy gets a gentle message: *"Mummy, medicine ka time ho gaya. 💊"*
5. **Confirm.** She replies *"Haan, maine le li."* SMARAN answers warmly and records the confirmation with its time.
6. **Remember.** The family dashboard, Health Card and timeline update instantly.

## Wispr Flow integration

Wispr Flow is a system-level dictation app. It types into whatever text field has focus, so SMARAN's job is to provide good text fields and to react well to dictated text:

- `WisprFlowInput` is a reusable input with idle, listening, transcribing, ready and error states, and it uses the Wispr Flow mark (no generic microphone icons).
- **Mobile:** the helper text reads *"Tap this button on the right side of your phone to use Wispr Flow."*
- **Web:** the helper text reads *"Use your configured Wispr Flow shortcut to dictate into this box."* SMARAN shows the platform default as a hint (hold `fn` on Mac, `Ctrl + Win` on Windows).

**Browser limitations, stated plainly.** A web page cannot start Wispr Flow, detect whether it is installed, or listen to the microphone through it. Tapping the Wispr button focuses the box and shows a listening state; the real transcription arrives from Wispr Flow as typed text. For demos without Wispr Flow, every input has a **"Use sample phrase (demo)"** button that types a sample phrase in, and `Alt + W` puts the main input into its listening state from anywhere on the page. If nothing arrives within 12 seconds, the input shows *"We couldn't capture that. Try speaking again."*

## Features

- **Today** — 7-day selector, today's reminders and appointments with live status (waiting, upcoming, confirmed, missed, paused), family status, and a Wispr capture box.
- **Natural-language capture** — reminders (daily, weekly, one-off) and appointments ("Friday ko 11 baje… teen din pehle yaad dila dena" → Fri Oct 30, 11:00 AM, reminder 3 days before). Every field is editable; duplicates update the existing item and keep its history.
- **Reminder conversation** — the chat Mummy sees, with replies for confirm, snooze, "dawai khatam ho gayi", "tabiyat theek nahi" and more. Unclear replies get a gentle follow-up, never medical advice.
- **Family dashboard** — each person's day at a glance, add and edit family members.
- **Appointments** — upcoming, later and completed; reminder offsets you can toggle or add; attach documents.
- **Document vault** — upload a PDF or photo (or use a fictional sample), describe it by voice, link it to an appointment, preview it.
- **Health Card** — one card per person with upcoming visits, medicines and checks, recent confirmations and documents, plus a print-friendly share page (`/share/health-card/:id`).
- **Ask SMARAN** — questions like *"Mummy ka latest blood report kab ka hai?"* answered only from saved data, with links to the source. Questions about doses or symptoms are redirected to the doctor.
- **Memory timeline** — everything that happened, filterable by person and kind.
- **Settings** — profile, family, English/हिन्दी navigation and greetings, reminder sound, Wispr Flow toggle, notifications, JSON export, privacy notes, demo clock, reset demo, clear all data.
- **Onboarding** — welcome plus four onboarding steps, including a live Wispr parsing demo and family setup.
- **Mobile | Web toggle** — the same app and the same state shown inside a phone frame or as a full desktop layout. Narrow screens always get the mobile layout.
- **Demo mode** — one-click scenarios: create the medicine reminder, confirm it, create the appointment, upload a document, ask SMARAN, start the full story, reset.

## Data and privacy

There is no backend, account or network call for family data.

- App state lives in `localStorage` (`smaran:state`) and syncs across tabs.
- Uploaded files are stored in the browser's IndexedDB (`smaran-files`) and never leave the device.
- SMARAN does **not** read file contents (no OCR). Document details come from the file name, your description, or what you type.
- All preloaded people, reminders, appointments and documents are fictional. Sample documents are watermarked and show no clinical values.

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
npm run build    # production build
npm run start    # serve the production build
```

## Deploy

The app is a standard Next.js project with no server-side secrets, so it deploys to Vercel as-is: import the repository in Vercel, keep the detected Next.js settings, and deploy. No environment variables are required.

## Demo script

1. Open `/welcome` and step through onboarding (or open **Demo mode → Start the full story**).
2. On **Today**, press the Wispr button (or **Use sample phrase**) and send *"Mummy ko roz raat 9 baje BP ki medicine yaad dilani hai."*
3. Review the **I understood** card and create the reminder.
4. Choose **Send it to Mummy now (demo)**, open the reminder, and send *"Haan, maine le li."*
5. See the confirmation, then the family dashboard and Mummy's Health Card.
6. Create the appointment: *"Mummy ka Dr Sharma ke saath Friday ko 11 baje appointment hai. Teen din pehle yaad dila dena."*
7. Upload the sample blood report and attach it to the appointment.
8. Ask *"Mummy ka latest blood report kab ka hai?"*
9. Switch **Mobile | Web** at any point — it's the same state.

The demo clock starts on Friday, October 23, 2026 at 10:30 AM. Sending a reminder moves the clock to its scheduled time; you can also set the clock in Settings.

## Brand assets

`public/brand/smaran-mark.svg` and `public/brand/wispr-flow.svg` are placeholders. Replace them with the official files at the same paths (see `BRAND_ASSETS` in `src/components/smaran/brand.tsx`).

## Limitations

- Reminders are not delivered to a real phone. The family member's side is simulated in the reminder chat.
- Wispr Flow is used as a system dictation tool. SMARAN cannot trigger it from the browser.
- The language parser is rule-based. It handles common Hindi, English and Hinglish phrasing for people, times, days, doctors and reminder offsets, and asks when it isn't sure.
- No OCR or document understanding. No medical advice, ever.
- Data is per-browser. A shared Health Card link only opens on the device holding the data; use Print → Save as PDF to share it elsewhere.
