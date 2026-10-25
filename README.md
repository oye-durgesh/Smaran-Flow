# SMARAN · स्मरण

Family health vault: dictate with **Wispr Flow** into the focused text box, press Send, review a structured proposal, then save. Claude (optional) interprets on the server. SMARAN never records microphone audio and never writes on Claude’s word alone.

## Wispr Flow vs Claude vs SMARAN

| Layer | Role |
|---|---|
| Wispr Flow | System dictation into the focused textarea. No Wispr API key. |
| Claude | Optional server-side interpretation (`ANTHROPIC_API_KEY`). Returns an untrusted proposal. |
| SMARAN | Validates, asks one clarification when unsure, persists only after Confirm. |
| Scheduler | `GET /api/cron/reminders` is **blocked** until Supabase + VAPID are configured. Saving a reminder is not delivery. |

## Run locally

Node 20.9+.

```bash
npm install
cp .env.example .env.local   # add keys locally; never commit them
npm run dev -- -p 43117
```

Open http://localhost:43117

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

## Environment variables

Use `.env.local` and Vercel Project Settings. Never `NEXT_PUBLIC_ANTHROPIC_API_KEY`.

```
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
CRON_SECRET=
```

`.env*` is gitignored except `.env.example` (placeholders only).

Without Anthropic, `/api/interpret` uses the deterministic parser and sets `claudeUsed: false`. Without `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, the app stays in **device-local mode** (`localStorage` + IndexedDB) and labels that clearly. It does not pretend browser data is cloud-synced.

Apply `supabase/migrations/0001_smaran_family.sql` through `0006_health_record.sql` in a Supabase project, then sign in under Settings. Care recipients (Mummy/Papa) are not login accounts. Use **Copy this browser's records into my family** to migrate local rows; local copies are never deleted automatically.

**Medicines** is a first-class section: current courses, dose reminders, refill reminders, and history, grouped by the actual care recipients in the family. Dose reminders and pharmacy pickups stay separate. The Health Card and Today read the same saved medicine records.

**Family Health Record** (open a person from Family / Health Card) is a person-specific file: Overview, Medical History, Measurements, Documents & Reports, Appointments & Visits, Vaccinations, and Health Diary. Charts use only confirmed saved readings for that person. Sample notes stay labelled and are excluded from BP/glucose trends. Blood pressure stores systolic and diastolic separately. A reported glucose of `38` is kept exactly and marked for review. `+ Add record` stays on the selected person. The standalone Documents page uses the same document rows.

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never put it in a `NEXT_PUBLIC_` variable.

## Consent / privacy

- Interpret sends the transcript and first names to `/api/interpret`. No document bytes.
- Document cloud extract requires header `x-smaran-consent: cloud-extract`. That path may send extracted text to Anthropic when a key exists.
- Health Card share URLs read the same browser store. They do not publish another family’s data across devices.

## What is implemented vs blocked

See the table at the end of this file and `docs/manual-tests.md`.

Apply `supabase/migrations/0001_smaran_family.sql` only after you create a Supabase project. RLS policies are family-scoped.

## Limitations (honest)

- Cross-device auth and row-level live data: **blocked** until Supabase keys exist.
- Real push / SMS delivery: **blocked** until VAPID (or another provider) is configured and tested on two devices.
- Scanned-PDF OCR: **blocked** on Vercel without a vision key or OCR worker. Text PDFs use a conservative local text scrape.
- Demo sample family can still hydrate empty browsers; **new** date words resolve in **Asia/Kolkata** against the real clock, not Friday 23 Oct 2026.

## Feature status

| Feature | Status | Evidence | Manual configuration |
|---|---|---|---|
| Wispr/text capture, single submit, examples fill-only | verified (unit + code) | `WisprFlowInput` submit lock + DOM sync; `npm test` | Wispr desktop app |
| Unknown text does not create a reminder | verified | `src/lib/nlu/intents.test.ts` | — |
| Health measurement confirm-before-save | verified | Speak box confirm card | — |
| Medicine vs pickup intents | verified | intent tests | — |
| Appointment complete unique / ambiguous | verified | intent tests + UI confirm | — |
| Medicine reminders section `/medicines` | verified (local persist) | Medicines screen + store | — |
| Claude `/api/ai/interpret` | partial | Zod + local parser tests; live Claude needs key | `ANTHROPIC_API_KEY` |
| Grounded Ask `/api/ask` | partial | Local evidence + `answerQuestion` tests; no live Claude summarizer | device evidence or Supabase |
| Supabase family vault + session | code ready, live unverified | `/api/session`, `/api/vault`, `/api/auth`, RLS SQL | URL + anon key + apply migrations |
| Appointment complete/cancel/reschedule | unit + API | matching asks when ambiguous; writes go to DB when signed in | signed-in family |
| Web Push / cron delivery | blocked | `/api/cron/reminders` returns `delivered: 0` | VAPID + cron secret |
| OCR on scans | blocked | Extract route fails honestly without key/worker | Anthropic vision or OCR worker |
| Cross-family RLS live | blocked | policy SQL + unit rules; no live two-account run | two Supabase users |
| Family Health Record (per person) | verified (local persist + unit) | Health Record tabs, charts from saved measurements, `/api/health-record` | Apply 0006; signed-in UUID recipients for cloud writes |
| Health Card share across devices | blocked | Same-browser store | Print to PDF |
