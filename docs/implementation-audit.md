# SMARAN implementation audit

Read-only inspection of the current working tree on `main` (`0c83847`, “Initial Smaran release”). Application logic was not changed for this audit. Line numbers match the tree as inspected.

**Working tree:** clean (`git status` reported nothing to commit).
**Stack:** Next.js 16.4.2 App Router, React 19.3, TypeScript 5, Tailwind 4, shadcn/Base UI. No `src/app/api` routes.

---

## 1. Arbitrary / unknown text defaults to creating a reminder

There is no “unknown intent” type. After health, question, and appointment heuristics fail, leftover text is **always** a reminder.

| Location | What happens |
|---|---|
| `src/lib/nlu/index.ts` **17–21** `classifyCapture` | `looksLikeHealth` → `isQuestion` → `looksLikeAppointment` → **`return "reminder"`**. |
| `src/lib/nlu/command.ts` **14–19** `parseSmaranCommand` | Same order; **`return { intent: "reminder", text: trimmed }`**. |
| `src/components/smaran/smaran-speak-box.tsx` **40–61** | After health confirm / question / `onCapture`, **`router.push(\`/new?kind=${cmd.intent}&text=…\`)`**. Unknown text therefore opens capture as `kind=reminder`. |
| `src/components/screens/today.tsx` **22–25** `useCaptureSubmit` | **`/new?text=…`** (no kind). Capture then uses `classifyCapture` → reminder. |
| `src/components/screens/capture.tsx` **58–68, 79–96** | `fixedKind ?? classifyCapture(text)`. Default UI kind is **`"reminder"`** (line 66). Health is dropped (`if (intent === "health") return`). Question redirects to Ask. Else reminder or appointment. |
| `src/components/screens/onboarding.tsx` **140–143** | Every submit is **`parseReminder`** then a reminder-only processing demo. |
| `src/lib/nlu/reminder.ts` **72–80, 104–108** | `kind` **starts as `"medicine"`** even when no medicine title is found. Title may stay empty; kind still medicine unless check/activity match. |
| Empty / add CTAs | `today.tsx` **137, 186**; `family.tsx` **212, 220**; `reminder-detail.tsx` **38** all link **`/new?kind=reminder`**. |

`looksLikeAppointment` (`appointment.ts` **21–24**) only matches appointment/doctor keywords. `looksLikeHealth` (`health.ts` **19–24**) needs a measurement keyword plus a number or save verb. `isQuestion` (`common.ts` **245–249**) needs `?` or interrogative starters. Everything else is a reminder.

---

## 2. External dictation vs controlled textarea / single submit

**File:** `src/components/smaran/wispr-flow-input.tsx`

- Controlled: `value={value}` (**156**), updates **only** via `onChange={(e) => onChange(e.target.value)}` (**148**).
- No `onInput` / `onBeforeInput`, no `MutationObserver`, no polling of `textareaRef.current.value`.
- IME: Enter submit is gated by `!e.nativeEvent.isComposing` (**150**).
- Submit paths: Enter (**149–153**) and send button (**171**) both call `submit(value)` — React state, not the DOM node.
- Empty React state → **`CAPTURE_ERROR`** “We couldn't capture that. You can type instead.” (**25, 76–79**). Dictation that writes the DOM without firing `change` will look filled but send as empty.
- After a successful `onSubmit`, value is cleared once (**88**). There is **no in-flight lock** on the input except `busy` (used by speak-box only during health save, `smaran-speak-box.tsx` **64–77, 92**). Double-click / double-Enter can fire `onSubmit` twice before parent navigation.
- `Waveform` (**29–41**) is exported and unused by this input. Rotating examples (`setInterval` 4500 ms, **65–71**) are placeholder-only.
- Product stance (README): Wispr Flow is OS dictation into the focused field. SMARAN does not start Wispr, detect install, or record audio.

**Verdict:** Reliable for typing and for dictation engines that dispatch `input`/`change`. Not reliable for all OS dictation insertions. Submit is once per click/Enter, not hard-deduped.

---

## 3. Fake listening, captioning, progress, success, simulated reminder

| Surface | File:lines | What it is |
|---|---|---|
| Capture “listening” chrome | `capture.tsx` **168–174** | Eyebrow **“SMARAN is listening”**, title **“Understanding you…”**. Parsing already happened; `ProcessingState` is timed. |
| Processing steps | `processing-state.tsx` **7–10, 26–34** | Comment: paced for **legibility**; parse is instant. Default `stepMs=0` (capture); onboarding uses **480 ms** (`onboarding.tsx` **147**). |
| Onboarding walkthrough | `onboarding.tsx` **140–155** | Parses a reminder, shows fake steps, **does not persist**. “SMARAN understood” preview only. |
| Document “save %” | `document-upload.tsx` **114–128, 252–267** | `phase === "saving"`: interval +28% / 70 ms (or jump to 100 if reduced motion). **Does not track IndexedDB `saveFile`**. |
| Document “reading” | `document-upload.tsx` **271–276** | Title **“SMARAN is reading this document…”**; subtitle admits filename/description only. `ProcessingState` steps: Checking / Matching / Preparing. |
| Filename/description extract | `document.ts` **30–38**; `health.ts` `extractHealthValues` **79–98**; `document-upload.tsx` **92–96, 141–144** | No file bytes read. Sample file hard-codes Mummy / Blood Report / Dr Sharma / `2026-10-21` (**47, 92**). |
| Speak-box busy copy | `wispr-flow-input.tsx` **48**; `smaran-speak-box.tsx` **93** | **“Got it. Organizing this for you…”** — only while health `busy` is true (sync save). |
| Incoming reminder | `incoming-reminder.tsx`; `use-send-reminder.ts` **20–24** | **In-app banner**, not a notification. `useSendReminderNow` only sets `incomingReminderId`. Copy: “SMARAN · on {name}'s phone”. |
| Clock jump on send | `actions.ts` **179–202** `startConversation` | If scheduled time is still ahead of `demoNow`, **`demoNow` is set to the reminder time**. Seeded messages pretend the reminder was sent. |
| Welcome mock chat | `welcome.tsx` **44, 62** | Static illustration, not a live conversation. |
| Toasts / saved copy | speak-box **70–72, 122–126**; appointments **255**; reminder-detail **153** | Real store writes + toast. Not fake, but times use `demoNow`. |

There is **no** SpeechRecognition / MediaRecorder / captioning pipeline. No fake microphone listening timer in `WisprFlowInput`.

---

## 4. “Tomorrow”, weekdays, and the demo clock

**Product clock is `state.demoNow`, not the wall clock.**

- Seeded clock: `src/lib/seed.ts` **17–18** `DEMO_TODAY = "2026-10-23"` (Friday), `DEMO_NOW = "2026-10-23T10:30"`.
- Empty / corrupt `localStorage` hydrates **`createDemoState()`** (`store.tsx` **25–32**), so first visit is the demo Friday 10:30 family.
- `AppState.demoNow` (`types.ts` **207–208**): “Local family clock. Everything today is relative to this.”
- `todayOf` = `dateOf(state.demoNow)` (`selectors.ts` **15**). Agenda, Ask, NLU dates, greetings (`today.tsx` **95**), confirmation timestamps, document `addedAt`, measurements `recordedAt` all use it.
- `realNow()` exists (`dates.ts` **125–128**) and is **never called** elsewhere in `src/`.
- `setDemoTime` (`actions.ts` **420–422**) only changes the time-of-day on the current demo date.
- `startConversation` / `replyInConversation` (`actions.ts` **179–228**) advance `demoNow`.

**`findDate(text, today)`** (`common.ts` **168–202**), `today` always comes from `todayOf(state)`:

| Phrase | Resolution |
|---|---|
| `parso` / day after tomorrow | `addDays(today, 2)` |
| `kal` / `tomorrow` / `tmrw` | `addDays(today, 1)` — **demo Saturday 2026-10-24** on a fresh seed, not the user’s real tomorrow |
| `aaj` / today / tonight | `today` (demo date) |
| Weekday words (`friday`, `somvar`, …) | Next occurrence; **`diff === 0` → +7** (`195–199`). Saying “Friday” on seeded Friday schedules **2026-10-30**, not today. |
| `N tarikh` / `15 oct` | Calendar on/after `today` |

`parseReminder` (`reminder.ts` **89–101**) uses that date for `frequency: "once"`; if no daily/weekly/date, assumes **every day**.

`frequencyLabel` (`selectors.ts` **46**) names weekdays via hard-coded Sunday **`2026-10-18`**, not `demoNow` — label-only.

---

## 5. Appointment lifecycle and “appointment done”

`AppointmentStatus` is only `"upcoming" | "completed"` (`types.ts` **74–88**).

Store (`actions.ts`):

| Action | Lines | Effect |
|---|---|---|
| `createAppointment` | ~260–294 | New row `status: "upcoming"`. |
| `updateAppointment` | **296–302** | Doctor/date/time/location/notes/member. |
| `setAppointmentStatus` | **304–310** | Writes status. On **`completed`**, appends `appointment_completed` memory event. |
| `toggleAppointmentReminder` / `addAppointmentReminder` | **312–330** | Offset flags on the appointment (local only). |
| `linkDocument` | **332–343** | Attach/detach document ids. |

**UI “Mark done” completes the existing appointment** (`appointments.tsx` **130, 251–258**):

```ts
update((s) => setAppointmentStatus(s, appointment.id, done ? "upcoming" : "completed"));
```

Reversible via “Mark upcoming”. Toast: `{doctor} appointment completed`.

**Caveat:** `completedAppointments` (`selectors.ts` **115–119**) also treats **`a.date < today`** as completed in lists even if `status` is still `upcoming`. That is display grouping, not a status write. There is no “appointment done” voice command; unknown speech still becomes a reminder.

Reminder “Mark done for today” (`reminder-detail.tsx` **147–157**) calls `confirmManually` — confirmation history, **not** appointment status.

---

## 6. Medicine reminders: kind vs dedicated section / task bar

`ReminderKind = "medicine" | "check" | "other"` (`types.ts` **30**). Icons differ (`cards.tsx` KIND_ICON; `reminder-detail.tsx` ICON). Chat reply chips differ (`reminder-chat.tsx` **87**). Ask lists medicines when the question matches (`ask.ts` **121–125**).

**There is no dedicated medicine task bar or medicine-only agenda.**

- Today agenda (`agendaFor`, `selectors.ts` **67–88**; `today.tsx` **111–140**) mixes **all reminder kinds + same-day appointments**.
- Family member page (`family.tsx` **159, 211–221**) section **“Medicines & checks”** is `state.reminders.filter(member)` — **medicine, check, and other**.
- Nav: Today / Family / Appointments / Documents / Ask (+ Memory, Settings). No Medicines tab (`navigation.tsx` **29–30**).
- Default new-reminder kind is medicine in the parser, but the UI does not surface a medicine rail.

---

## 7. Backend, auth, database, storage, OCR, cron, web-push, SMS

**None of these exist as product services.**

| Concern | Actual |
|---|---|
| HTTP API | No `src/app/api/**`. Static / PPR pages only. |
| Auth | No NextAuth, sessions, or login. `state.user.name` is local. |
| Database | `localStorage` key `smaran:state` (`store.tsx` **8, 25–47**). |
| File storage | IndexedDB `smaran-files` / store `files` (`files.ts` **1–37**). Bytes never uploaded. |
| OCR | Explicitly not implemented (`document.ts` **30**; upload copy; types metadata comment **111**). |
| Cron / scheduler | No jobs. Appointment `reminders[]` are toggles. `useSendReminderNow` is a banner. |
| Web Push / SMS | Settings flags `notifications` / `familyUpdates` (`types.ts` **190–193**) are UI-only. Incoming banner is React state (`view.tsx` **12–13, 21**). |
| LLM / STT | Rule-based NLU in `src/lib/nlu/*`. No OpenAI/Whisper client. |

`package.json` dependencies: Next, React, lucide, sonner, next-themes, CVA, shadcn, `@base-ui/react`. No Prisma, Supabase, Firebase, Twilio, web-push.

**Deploy:** `render.yaml` — Node 20 web service, `npm ci && npm run build`, `npm run start`, health check `/welcome`. No env secrets required. `next.config.ts`: `allowedDevOrigins: ["127.0.0.1"]`, `cacheComponents`, `partialPrefetching`, `instantInsights` validation `manual-warning`.

---

## 8. Scripts and baseline command results

**Scripts** (`package.json` **8–13**): `dev`, `build`, `start`, `lint`. **No `test` script. Zero `*.test.*` / `*.spec.*` files.**

Commands run for this audit (2026-10-25, UTC):

### `npm run lint` — exit **0**

```
> smaran@0.1.0 lint
> eslint

---LINT_EXIT:0---
```

(ESLint printed no warnings or errors.)

### `npx tsc --noEmit` — exit **0**

```
---TSC_EXIT:0---
```

(`tsc` wrote no diagnostics to stdout.)

### `npm test` — exit **1** (script missing)

```
npm error Missing script: "test"
npm error
npm error To see a list of scripts, run:
npm error   npm run
```

### `npm run build` — exit **0**

```
> smaran@0.1.0 build
> next build

▲ Next.js 16.4.2 (Turbopack)
✓ Running next.config.ts took 45ms
- Cache Components enabled
- Partial Prefetching enabled
- Experiments (use with caution):
  · instantInsights

  Creating an optimized production build ...
✓ Compiled successfully in 2.3s
  Running TypeScript ...
  Finished TypeScript in 3.4s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/22) ...
✓ Generating static pages using 3 workers (22/22) in 713ms
  Finalizing page optimization ...
```

Routes: `/`, `/welcome`, `/onboarding`, `/today`, `/new`, `/family`, `/family/[id]`, `/appointments`, `/appointments/[id]`, `/documents`, `/documents/[id]`, `/documents/upload`, `/reminders/[id]`, `/reminders/[id]/chat`, `/health-card/[id]`, `/share/health-card/[id]`, `/ask`, `/memory`, `/settings`, `/icon.svg`, `/_not-found`. Dynamic ids are Partial Prerender (`◐`); the rest Static (`○`).

---

## Navigation / shell (as shipped)

- `app-frame.tsx`: mobile header (logo, Memory, settings avatar), `DesktopSidebar` (`lg+`), `BottomNavigation` (5 tabs), `IncomingReminderBanner`, Sonner.
- Chromeless: `/`, `/welcome`, `/onboarding`. Focused (no nav): `/new`, reminder chat.
- `view.tsx`: breakpoint `max-width: 1023px`; `isWeb` is an alias of desktop.

---

## Recommended minimal architecture (do not implement in this audit)

Keep one Next.js client app. Do not add a platform. Change the smallest levers that make scheduling and capture honest.

### A. Clock

1. Persist `demoNow` only as a **debug override**. Default `todayOf` / new timestamps to `realNow()`.
2. Seeded family can stay for empty first-run, but **advance “today” to the real date** on hydrate (or offer “Use sample Friday 23 Oct 2026” vs “Start from today”).
3. Stop advancing the product clock in `startConversation`.

### B. Intent

1. Add `CaptureIntent = … | "unknown"`. Default of `classifyCapture` / `parseSmaranCommand` should be **unknown**, not reminder.
2. Unknown → confirm chip: “Save as reminder / appointment / ask / discard”.
3. `parseReminder` should default `kind` to **`other`** until medicine/check phrases match.
4. Optional later: “appointment done” / “mark {doctor} done” → `setAppointmentStatus` after confirm (action already exists).

### C. Dictation / submit

1. On send, read `textareaRef.current?.value` if it is longer than React `value` (or listen to `input`).
2. Sync that into state, then submit once; ignore empty.
3. `submitting` ref so Enter + click cannot double-navigate.

### D. Honesty in UI

1. Drop “SMARAN is listening” unless audio is actually captured.
2. Keep `ProcessingState` only if labeled as a short review pause, or skip when `prefers-reduced-motion` (already faster) and optionally skip entirely.
3. Document upload: bind progress to `saveFile` completion; keep the no-OCR subtitle; do not imply reading medical contents.
4. Incoming banner: rename to in-app reminder (not “on {name}'s phone”) until SMS/push exist.

### E. Medicines

If medicine is a first-class job: filter `kind === "medicine"` on Today (section or chip) and split Family’s “Medicines & checks”. Do not invent a second nav item unless the list is long.

### F. Services (only when a real multi-device product is required)

Order: (1) honest local clock + intent, (2) optional account + synced store, (3) a scheduler that compares **server/real time** to reminder rows and sends **one** channel (web-push or SMS), (4) never OCR in v1. Auth/DB/cron/push are unnecessary for a single-browser family notebook.

### G. Quality bar

Add `npm test` with unit cases for `classifyCapture`, `findDate` vs a injected `today`, `parseReminder` kind default, and `setAppointmentStatus`. Lint/tsc/build are already green.

---

## Out of scope / not claimed

- No secrets were requested or required.
- This file is documentation only; application logic was not edited.
- Hosting beyond `render.yaml` was not provisioned in this audit.
