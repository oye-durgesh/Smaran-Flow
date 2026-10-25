# SMARAN · स्मरण

Family health vault: dictate with **Wispr Flow** into the focused text box, press Send, review a structured proposal, then save. Claude (optional) interprets on the server. SMARAN never records microphone audio and never writes on Claude’s word alone.

## Wispr Flow vs Claude vs SMARAN

| Layer | Role |
|---|---|
| Wispr Flow | System dictation into the focused textarea. No Wispr API key. |
| Claude | Optional server-side interpretation (`ANTHROPIC_API_KEY`). Returns an untrusted proposal. |
| SMARAN | Validates, asks one clarification when unsure, persists only after Confirm. |
| Scheduler | `GET /api/cron/reminders` writes **in-app** notification rows when `SUPABASE_SERVICE_ROLE_KEY` is set. Web-push stays blocked without VAPID. Saving a reminder is not a phone notification. Hosted minute cron is **not verified** until you confirm the job in the Vercel dashboard. |

## Run locally

Node 20.9+.

```bash
npm install
cp .env.example .env.local   # add keys locally; never commit them
npm run dev -- -p 43117
```

Open http://localhost:43117

### SMARAN Demo Family (Supabase)

Apply `supabase/migrations/0008_demo_workspace.sql` after 0001–0007. Sign in → Settings → **Load demo family data** (confirmation) → **Open SMARAN Demo Family**. This creates a second family workspace only. It does not write into your real family. Reset is a separate confirmed action. Claude/OCR are not required.

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

Apply `supabase/migrations/0001_smaran_family.sql` through `0007_in_app_notifications.sql` in a Supabase project, then sign in under Settings. Care recipients (Mummy/Papa) are not login accounts. Use **Copy this browser's records into my family** to migrate local rows; local copies are never deleted automatically.

### In-app reminder scheduler

1. Apply migration `0007_in_app_notifications.sql` (unique occurrence times + `in_app_notifications` RLS).
2. Set `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` on the host (never `NEXT_PUBLIC_`).
3. This repo includes `vercel.json` with `* * * * *` → `GET /api/cron/reminders`. Vercel Hobby plans often allow only a **daily** cron. If the dashboard rejects a one-minute schedule, use the shortest interval your plan allows, or trigger the same route from a Supabase `pg_cron` / external worker with `Authorization: Bearer $CRON_SECRET`.
4. Minute resolution is the honest precision. Do not expect second-level firing.
5. Two separate login accounts are notified only when both are members of the same family under RLS. Care recipients are not accounts. Cross-device delivery is not proven until those accounts exist and the hosted cron actually runs.

**Medicines** is a first-class section: current courses, dose reminders, refill reminders, and history, grouped by the actual care recipients in the family. Dose reminders and pharmacy pickups stay separate. The Health Card and Today read the same saved medicine records.

**Family Health Record** (open a person from Family / Health Card) is a person-specific file: Overview, Medical History, Measurements, Documents & Reports, Appointments & Visits, Vaccinations, and Health Diary. Charts use only confirmed saved readings for that person. Sample notes stay labelled and are excluded from BP/glucose trends. Blood pressure stores systolic and diastolic separately. A reported glucose of `38` is kept exactly and marked for review. `+ Add record` stays on the selected person. The standalone Documents page uses the same document rows.

**Documents & Reports** is a person-centered health-vault dashboard: summary cards, separate BP and glucose charts, medical history, document categories, vaccinations, and a Wispr Flow ask panel. Text PDFs can be extracted locally for review. Scanned-image OCR is not configured. Sample BP/glucose fixtures stay labelled and never write to the family Health Card. Confirmed BP/glucose from a real report become one linked measurement and refresh that person's charts.

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
| Documents library + extract review | verified (local persist + unit) | Documents workspace, local PDF text extract, sample demos isolated | Claude/vision OCR still unconfigured |
| Ask SMARAN chat UI | verified (unit + local retrieve) | WhatsApp-style `/ask`, `answerQuestion` + `/api/ask` | Claude not used; live vault unverified |
| Health Card share across devices | blocked | Same-browser store | Print to PDF |
