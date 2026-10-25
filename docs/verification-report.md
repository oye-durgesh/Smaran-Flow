# SMARAN verification report

Date: 25 Oct 2026, Asia/Kolkata. Branch `main`. **No push, no deploy, no secrets committed.**

## Family Health Record (this pass)

The per-person Health Card opens a Family Health Record for the selected care recipient. Navigation is driven by that person’s saved id — a new family member gets the same sections with empty states, not a copy of someone else’s readings.

- Header: actual name, relationship and age only when stored, family identity colour, last saved update from memory timestamps, **Add record**, **Print**.
- Tabs: Overview, Medical History, Measurements, Documents & Reports, Appointments & Visits, Vaccinations, Health Diary.
- Overview cards and charts read saved measurements, appointments, and history. Sample rows are labelled and **excluded from charts**. Missing weeks stay empty. Weekly view uses the latest actual Sunday–Saturday reading.
- BP stores systolic and diastolic separately. Glucose keeps the reported value, unit, and context; `38` is not rewritten.
- Documents in the record are the same `documents` rows as the standalone Documents page, filtered to that person.
- Appointments are the same records as Family Appointments.
- Device-local writes use `recordMeasurement` / `saveHistory` / `saveVaccination` / `saveDiary`. Signed-in UUID recipients POST `/api/measurements` or `/api/health-record`. Failed writes keep the form and do not toast success.
- This is a family record, not a diagnosis or treatment plan. Claude / OCR were not added in this pass.

### New migration

`supabase/migrations/0006_health_record.sql` — measurement systolic/diastolic/glucose_context/note columns; `medical_history`, `vaccinations`, `health_diary` with family RLS. Earlier migrations were not rewritten.

### Commands this pass

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run lint` | **0** | |
| `npm test` | **0** | **126 passed**, **4 skipped** (live Supabase) |
| `git diff --check` | **0** | |
| `npm run build` | **0** | Routes include `/health-card/[id]`, `/api/health-record` |

Not verified live: applying 0006, two-account RLS, OCR/Claude extraction, notification delivery, cross-device vault, click-test of chart tooltips on a phone.

---

## Family Appointments (prior pass)

Appointments is a dedicated family visits workspace. Today’s weekly progress calendar was not changed.

- Title **Family Appointments**, subtitle “Every visit, every doctor, every follow-up.” Primary action **+ New appointment**.
- Summary counts (upcoming / awaiting follow-up / past) come from saved records.
- Tabs: Calendar (default), Upcoming, Past visits, Follow-ups, Doctors. Calendar uses `monthGrid` / `Asia/Kolkata` live dates, not `demoNow` or hardcoded 23/25 Oct.
- Selected-day agenda only shows saved visits. Empty days stay empty.
- Family identity colours come from recipient IDs. Status chips stay separate. Recipients come from `state.family`.
- Doctor directory (`family_doctors` + `state.doctors`): primary vs specialist, reuse by name, archive. Names are never invented (`dr` stays `dr`).
- New appointment form validates recipient/doctor/date/time. Device-local `saveAppointment` is idempotent on member+doctor+date+time. Cloud POST returns the existing row on retry. Success only after persist.
- Overdue upcoming visits are **Needs review**, not auto-completed. Past visits require an explicit completed/attended record.
- Follow-ups need a confirmed date and appear on the calendar / upcoming list without duplicating on retry.
- Reminder offsets are stored on the appointment. Copy states they are schedules, not delivered notifications.
- Duplicate-card audit: merge key now includes time; list rendering keys by id; sample source is labelled.

### New migration

`supabase/migrations/0005_doctors_and_followups.sql` — `family_doctors` + appointment follow-up/clinic/reminder columns + unique upcoming index. Reuses the existing `appointments` table.

### Commands this pass

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run lint` | **0** | |
| `npm test` | **0** | **112 passed**, **4 skipped** |
| `git diff --check` | **0** | |
| `npm run build` | **0** | Routes include `/appointments`, `/api/doctors` |

Not verified live: applying 0005, two-account RLS, phone notification delivery, browser calendar click-test.

---

## Medicines section (prior pass)

The reminder-only “Today's Medicines” screen is a family medication workspace.

- Nav and page title: **Medicines**. Subtitle: “Every medicine, every schedule, every family member — organized in one place.”
- Grouped by real `care_recipients` / `state.family` ids. Mummy / Papa / Dadi colours come from `familySwatch()`; extra people get a stable fallback. Dadi is not shown unless that person exists.
- Tabs: Current medicines (default), Dose reminders, Refill reminders, Medicine history. Family filter is Everyone + actual members.
- Add medicine is a validated form with review/confirm. Device-local save uses `createMedicine`. Signed-in UUID recipients POST `/api/medicines`. Success only after persist.
- Dose reminders stay `kind: medicine`. Refills are `medicine_refills` + `reminderRole: refill`. Pickup remains `kind: pickup` on Today.
- Missing dose/strength/quantity stay “Not recorded”. Supply days are calculated only when quantity and units-per-dose are both recorded.
- Schedule edit reconciles future dose reminders and keeps completed confirmation history. Pause stops new active doses. Completing a course is not the same as marking one dose taken. History is not deleted.
- Health Card “Current medicines” and Today agenda read `state.medicines` / linked dose reminders.

### New migration

`supabase/migrations/0004_medicines.sql` — `medicines`, `medicine_changes`, `medicine_refills`, reminder `medicine_id` / `reminder_role`, RLS via `is_family_member`. Needed because 0001–0003 only stored `medicine_name` on reminders.

Vault load treats a missing medicines table as empty so older projects still boot.

### Commands this pass

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run lint` | **0** | |
| `npm test` | **0** | **98 passed**, **4 skipped** (live Supabase) |
| `git diff --check` | **0** | |
| `npm run build` | **0** | Routes include `/medicines`, `/api/medicines`, `/api/refills` |

### Flows that work in unit tests / device-local code

Add/validate medicine, failed save without success, no invented dosage, schedule edit preserves history, no duplicate reminders on retry, pause, complete vs mark taken, history vs current, refill vs dose, no fabricated supply, family isolation helper, Health Card + Today same ids, archived not current, Asia/Kolkata stamp, nav label.

### Not verified live

Applying 0004 on a real project, RLS with two accounts, phone notification delivery, cross-device vault after refresh, browser click-test of desktop/tablet/mobile overflow. Do not treat unit tests as live RLS proof.

---

## Family identity colors (prior pass)

Today Upcoming/Schedule cards and the Health Card shortcut use `familySwatch()`: Mummy coral, Papa amber, Dadi terracotta-rose. Legend lists only people in `state.family`. Status badges stay independent of identity.

## Weekly care-progress calendar (prior pass)

Today’s month grid is replaced by a Monday-first seven-day strip. Rings use `dayCareProgress()` over the same reminders and appointments as the schedule (paused/cancelled excluded; appointments are not auto-missed). Controllable-clock unit tests cover empty/pending/partial/complete/missed, recurrence, and year-boundary weeks.

## Today / Home (prior pass)

Today uses `calendarToday()` / `zonedNow("Asia/Kolkata")`, not `demoNow` (Friday 23 Oct). Greeting date is formatted at runtime (`Sunday, 25 October 2026` when that is the live Kolkata day). Month grid + year-boundary helpers live in `src/lib/timezone.ts`.

Layout: left sidebar (Today, Today's Medicines, Family Appointments, Documents, Ask SMARAN, Settings, Health Cards, About Me). Memory is not a sidebar item (`/memory` still exists). Center: greeting → month calendar → Upcoming → Today's Schedule → shortcuts. Right (xl+): compact Wispr panel. Family Today rail removed. Mobile: hamburger drawer + overflow-x-hidden.

Today capture stays on `/today` and writes through `createReminder` / `createAppointment`. Failed saves return an error string, not success.

Commands this pass: `npm run lint` 0 · `npx tsc --noEmit` 0 · `npm test` **56 passed**, 4 skipped · `git diff --check` 0 · `npm run build` 0.

Honest leftovers: live browser visual/QA of calendar and drawer not click-tested here; mobile overflow is CSS-constrained, not a device lab test; Claude still unused; `/memory` is reachable only by URL.

This report does not treat “code exists” as “it works.” Live Supabase, Claude, OCR, two-account RLS, and push remain unverified in this environment.

---

## 1. What this phase changed

Single source of truth and authentication foundation:

- Server session uses `supabase.auth.getUser()` plus `family_memberships`. No stub JWT.
- Family records load through the user-scoped Supabase client and RLS (`is_family_member`). The service role key is server-only and never `NEXT_PUBLIC_`.
- Authenticated UI hydrates appointments, reminders, measurements, documents, memory, and care recipients from `GET /api/vault`. Browser `localStorage` is kept as a **separate** device copy and is never auto-deleted.
- Device-local mode is explicit when URL/publishable keys are missing. The chrome banner and Settings copy say so. Browser data is not labeled as cloud-synced.
- New local records stamp `zonedNow()` (Asia/Kolkata), not `demoNow`.
- Appointment complete / cancel / reschedule: unique match only; ambiguous match asks which visit; writes go to Postgres when signed in; success only after the API confirms.
- Interpret uses vault appointments when authenticated. In device-local mode it may use `deviceAppointments` from the same UI store so “appointment done” can match what is on screen. Client-supplied family IDs are never authorization.
- Settings: sign up / sign in / sign out and an explicit **Copy this browser's records into my family** migrate (consent required). Sample Mummy/Papa remain sample/demo records.

---

## 2. Migrations

| File | Purpose |
|---|---|
| `supabase/migrations/0001_smaran_family.sql` | families, profiles, memberships, care_recipients, appointments + history, reminders + occurrences, measurements, documents, base RLS |
| `supabase/migrations/0002_rls_history_and_auth.sql` | `is_sample`, care_notes, memory_events, history columns, `is_family_member`, `handle_new_user`, `ensure_own_family`, RLS on all family tables, private `family-documents` bucket |
| `supabase/migrations/0003_reminder_delivery.sql` | `reminder_delivery_attempts` separate from reminder schedules |

Apply in that order in the Supabase SQL editor. Not applied in this environment.

---

## 3. Environment variable NAMES

Configure in `.env.local` (gitignored) or the host. Values are never committed.

| Name | Where | Required for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Auth + vault |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public (publishable) | User-scoped client / RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Admin/service paths; never `NEXT_PUBLIC_` |
| `ANTHROPIC_API_KEY` | server only | Live Claude |
| `ANTHROPIC_MODEL` | server only | Optional model override |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | public | Web Push subscribe |
| `VAPID_PRIVATE_KEY` | server only | Push send |
| `VAPID_SUBJECT` | server only | Push identity |
| `CRON_SECRET` | server only | Protect reminder cron |

Without the two `NEXT_PUBLIC_SUPABASE_*` names the app is **device-local**.

---

## 4. Commands run (this pass)

| Command | Exit | Notes |
|---|---|---|
| `npm ci --ignore-scripts` | **0** | Lockfile includes `@supabase/ssr` and `@supabase/supabase-js`. |
| `npm run lint` | **0** | After moving session hydrate off a sync `setState` in `useEffect`. |
| `npx tsc --noEmit` | **0** | |
| `npm test` (`vitest run`) | **0** | **39 passed**, **4 skipped** (live Supabase integration), 0 failed. |
| `git diff --check` | **0** | Worktree. |
| `npm run build` | **0** | Next 16.4.2. New routes: `/api/auth`, `/api/session`, `/api/vault`, `/api/appointments`, `/api/reminders`, `/api/measurements`, `/api/migrate`, `/api/family`. |

These unit tests are **not** proof of live Supabase RLS or two-device sync.

---

## 5. Tests

Unit coverage added for: own-family allow, other-family deny, two permitted accounts, unique/none/ambiguous appointment match, sample-row isolation, VaultError vs fake success, UUID vs mummy/papa ids, new-record timestamps ≠ `DEMO_NOW`.

`src/lib/server/supabase.integration.test.ts` is **skipped**. It is not proof of live RLS or cross-device behavior.

---

## 6. How to verify two separate family accounts

1. Apply migrations 0001–0003 on a Supabase project. Put URL + publishable key in `.env.local`. Restart the app.
2. Browser A: Settings → Create account (`family-a@…`). Add a care recipient (not a login). Create an appointment. Reload — the same row must return from `/api/vault`.
3. Browser B (private): Create `family-b@…`. `/api/vault` must not contain family A’s appointment. Completing family A’s id must 404/deny.
4. To share one family: insert a second `family_memberships` row for user B on family A (owner action). Both sessions should then see that appointment.
5. Sign out. Banner must return to “not signed in” / device-local. Local sample Mummy/Papa must still be in this browser.

This two-account path was **not run here** (no credentials).

---

## 7. Remaining before production claims

| Area | Status |
|---|---|
| Claude live interpret | Needs `ANTHROPIC_API_KEY` + live call |
| Document OCR / vision | Extract still fails scans without a worker/key |
| Phone / web-push notifications | Cron still `delivered: 0` without VAPID + a real send |
| Live RLS / two devices | Needs applied migrations + two accounts |
| Document binary storage | Metadata table + bucket policies exist; full upload path not E2E |
| Interpret fetch fallback | `requestInterpretation` still falls back to local rules if the server fails |

---

## 8. Security notes

- Tracked env: `.env.example` placeholders only.
- No service-role key in client components.
- Authorization uses `auth.uid()` membership, not a client-supplied family id.
- Care recipients are not `auth.users`.
