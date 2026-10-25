# SMARAN verification report

Date: 25 Oct 2026, Asia/Kolkata. Branch `main`. **No push, no deploy, no secrets committed. No demo reseed. No family data wipe.**

## User-facing reliability follow-up

What was still broken in the running app:
- Upload never called `/api/documents/extract`, so OCR could not run.
- `ensure_own_family` inserted `families.created_by` without a `profiles` row → vault error, empty Ask, no cloud reminders.
- Due notifications were not written to Supabase while the app was open unless a service role cron ran.

Fixes in this pass:
- Upload reading step now calls the existing extract API and shows honest review text.
- Migration `0010_ensure_profile_before_family.sql` creates the profile before the family.
- Signed-in `/api/reminders/process` writes due in-app notifications for the active family; the Alerts bell calls it every 20s while the tab is open.

Still not live-verified: Anthropic OCR, hosted minute cron, applying 0010 on the remote project.

---


## Reliability pass — parser, scheduler, selective Claude, OCR, Ask

### Root causes found

1. **Simple reminders.** `\byaad dila\b` did not match **yaad dilana**. BP-check titles required adjacent “bp check”. `findPerson` picked the first name/alias instead of asking when several people matched.
2. **Scheduler.** Saving a reminder row is not delivery. Vercel Hobby cron cannot run every minute. Processor needed an atomic occurrence claim. `/api/reminders/status` still reports `hostingCronVerified: false`.
3. **Complex Hinglish.** The previous phase forced rules-only and never called Claude even when the parser was `unknown`.
4. **Scanned OCR.** Extract stopped at local PDF text. Images and empty scanned PDFs never used vision, and also must not fake success without a key.
5. **Ask retrieval.** Authenticated Ask loaded a thin snapshot (names only, no refill role, no vaccinations/diary/memory). Unextracted files were treated like searchable report text.

### What was fixed

- Parser: `yaad dilana`, looser BP-check window, unique-person matching via `findPeople`, refill/appointment examples.
- Ask: vault snapshot includes full authorized records; unextracted docs are labelled as not searchable; person mismatch/ambiguity stays honest.
- Claude: used only when `needsClaudeFallback` is true **and** `ANTHROPIC_API_KEY` is set. Simple commands stay on rules.
- Extract: selectable PDF → `parseLabText`. Scanned PDF/image → Claude vision/PDF **if configured**, otherwise honest `not_extracted`.
- Processor: claim occurrence `scheduled/due → processing` before insert. Optional `0009_supabase_cron_reminders.sql` documents pg_cron (no-op SQL). Settings can schedule a 2-minute **real** test reminder on an authenticated family with a UUID recipient.

### Commands actually run

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run lint` | **0** | unused-import warning fixed |
| `npm test` | **0** | **261 passed**, **4 skipped** (live Supabase) |
| `git diff --check` | **0** | |
| `npm run build` | **0** | |

### Integrations not live-verified

- Live Claude API: **not called** in this environment (no verified successful provider request).
- Scanned OCR: code path present; **not** proven against a real Anthropic vision call.
- Hosted scheduler: **not active/verified**. Need Supabase `pg_cron`/`pg_net` + `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY`. Vercel Hobby cron is not minute-level.
- Live RLS / two-account Ask: skipped.

### Completion answers

1. Files: NLU, Ask snapshot, interpret fallback, extract+vision, processor claim, Settings test reminder, migration 0009 (no-op), tests, this report.
2. Root causes: listed above.
3. Fixed: parser gaps, Ask vault grounding, selective Claude, honest OCR, atomic claim + cron docs.
4. Tests: 261 passed, 4 skipped.
5. Real services: none live-verified this session.
6. Reminder scheduling: **not verified active**.
7. Live scanned OCR: **not verified**.
8. Ask: retrieves from authorized vault snapshot in code; live Supabase Q&A **not** run.
9. Manual: set `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` server-side; enable pg_cron per 0009 comments; keep `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` in server env.

---


## Existing flow hardening (this pass — before Claude)

### Audit table

| Capability | Existing implementation | Verified status | Required change |
|---|---|---|---|
| Wispr Flow text insertion | Shared `WisprFlowComposer` + `Use Wispr Flow` (no mic). Examples prefill only. | Working in unit tests and existing UI | None |
| Rule-based intent parsing | `classifySmaranIntent` / `interpretLocally` / `parseReminder` | Supported phrases pass; ambiguous text asks for details | Client now uses rules only (`claudeUsed: false`) |
| Section-context enforcement | `evaluateSectionPolicy` + `WISPR_SECTIONS` | Today previously allowed `medicine_write` | Removed; schedule-change language routes to Medicines |
| Supabase persistence | Authenticated APIs + vault refresh | Live two-account RLS **not** run here (`supabase.integration.test.ts` skipped) | Cloud reminder save uses captured IDs, not stale state |
| Appointment persistence | Appointments review modal + APIs | Today no longer has a dead appointment write branch | Policy + capture already blocked appointment writes |
| Medicine scheduling | `createMedicine` form + dose reminders | Medicines composer had **no** `onCapture` | Wired `captureOnMedicines` → `createReminder` after confirm |
| In-app notification delivery | `vercel.json` cron `* * * * *` → `/api/cron/reminders`; `/api/reminders/status` | Unit processor tests pass. **`hostingCronVerified: false`** | Reported honestly; not claimed live |
| Document extraction | Local selectable PDF text + `parseLabText`; scans `SCAN_UNAVAILABLE` | Extract route no longer calls Claude | Scanned OCR still unsupported |
| Ask retrieval | `answerQuestion` + `/api/ask` (`claudeUsed: false`) | Missing records stay honest; mutations blocked | Ask mutation href: Today for general reminders |

### Existing behavior preserved

- SMARAN branding, Wispr Flow logo, composer copy, global nav, empty workspace default (`createEmptyState`, STATE_VERSION 9).
- No auto-seed of demo family. No rewrite of applied SQL migrations. No duplicate stores.

### Bugs found and fixed

1. Today allowlist included `medicine_write` and a catch-all that allowed medicine schedule intents on Today.
2. Medicines Wispr composer understood requests but did not persist after confirm.
3. Today cloud path still tried `createCloudAppointment` after capture no longer returned appointments; reminder cloud save looked up the **pre-commit** store.
4. `/api/ai/interpret` and document extract could call Claude when a key existed. This phase now stays on the rules / local-text path.

### Section-context rules

- Today: general care reminders and queries only. Medicine **schedule** language → `Medicine schedules are managed in Medicines.` Appointment writes → Family Appointments. Measurements → Health Card.
- Medicines: dose/refill/check reminders and queries. No appointments.
- Appointments: appointment writes/queries only.
- Documents: search/upload; no silent appointment, medicine, or measurement writes.
- Health Card: person-scoped reads; medicine/appointment writes blocked.
- Ask: read-only; navigate to the owning module.
- Settings: preferences only.

### Real Supabase paths

- Code paths: `createCloudReminder` after Today/Medicines confirm when the recipient ID is a UUID and the session is authenticated; vault refresh on success; toast error on failure (no false success).
- Live RLS / two-account / hosted cron: **not verified**. Integration file remains skipped (no test credentials in this environment). Remote project was emptied in a prior user-requested wipe; this pass did not write or reseed it.

### Reminder scheduler

- Model: `reminders` → occurrences → `in_app_notifications`. Processor unit tests cover due time, idempotency, snooze, unauthorized access, failed writes.
- Hosting: `vercel.json` cron exists. `/api/reminders/status` reports `hostingCronVerified: false`. Service-role / cron secret depend on env. **Scheduler is not claimed fully functional in production.**
- In-app only. No SMS, call, WhatsApp, email, or browser push.

### Document extraction

| Source | Today |
|---|---|
| Selectable / text PDF | Local text extract + `parseLabText`; status `needs_review`; no auto-confirm |
| Typed notes | Same local parser |
| Scanned PDF / images | `not_extracted` / `SCAN_UNAVAILABLE` — Claude/OCR still required later |
| Confirmed measurements | Still require explicit review; source document relationship unchanged |

### Confirmation / errors

- Consequential appointment / medicine / measurement intents still show the review card.
- Failed parse, policy block, or cloud write surfaces an error and does not toast success.
- Confirm in the shared composer no longer toasts a generic “Saved.” without the section handler succeeding.

### Commands actually run

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run lint` | **0** | |
| `npm test` | **0** | **244 passed**, **4 skipped** (live Supabase) |
| `git diff --check` | **0** | |
| `npm run build` | **0** | Rules-only interpret + local extract |

### Claude-later categories

- **Rules handle now:** supported reminder phrases, section allowlists, clarification for missing person/time, Ask retrieval from saved records, empty-state honesty, local reminder merge, in-app processor logic, selectable-PDF text + regex labs.
- **Needs more rules/validation:** mixed Hindi/Hinglish that classifies as `unknown`; multi-appointment disambiguation UX; live RLS proof.
- **Genuinely benefits from Claude later:** messy mixed-language multi-intent utterances; narrative document text beyond regex; concise grounded summaries of retrieved rows.
- **Needs OCR/vision:** scanned PDFs and images.
- **Ordinary backend, not an LLM:** auth, RLS, cron, duplicate prevention, charts, persistence.

Claude must not be required for a basic reminder save, appointment write, table query, due-time check, or in-app notification.

### Completion answers

1. **Worked before:** shared Wispr UI, rule parser for supported phrases, appointment review on Appointments, Ask read-only, Settings prefs, empty default workspace, local reminder processor tests, document status honesty for scans.
2. **Repaired:** Today medicine-schedule leak; Medicines NL persist; stale cloud reminder payload; accidental Claude calls on interpret/extract.
3. **Verified vs real Supabase:** **not** in this environment. Authenticated write **code** is present; live writes were not executed.
4. **Section boundaries:** **enforced** in `evaluateSectionPolicy` + capture helpers + tests.
5. **Scheduler:** configured in repo (`vercel.json`); **hosting execution not verified**.
6. **Document extract today:** local selectable text + lab regex. No visual OCR.
7. **Claude later:** messy language, multi-action utterances, complex document text, scan vision, grounded summaries.
8. **Incomplete:** live RLS, hosted cron fire, two-account auth tests, OCR, Claude (intentionally deferred).

---

## Isolated Supabase demo family (this pass)

### What was implemented

A separate **SMARAN Demo Family** workspace, seeded only after a signed-in user confirms **Load demo family data** in Settings. Real-family rows are never written by the seeder. Session `profiles.active_family_id` (verified membership) chooses the vault for Today, Medicines, Appointments, Documents, Health Cards, Ask, and inbox.

Seed contents (deterministic, relative to the seed-day in `Asia/Kolkata`):
- 4 recipients (Mummy 58, Papa 62, Dadi 78, Dada Ji 82) with stable colours
- 5 fictional doctors
- 10 medicine courses (active / paused / stopped / completed)
- Dose + refill reminders
- Upcoming, completed, and cancelled appointments
- ≥6 sample document previews per person (`storage_path = demo-preview`, not a private file)
- Medical history, vaccinations, diary, memory events
- 52 weekly BP + 52 weekly glucose readings per person (416 measurements)

### How to activate

1. Apply `supabase/migrations/0008_demo_workspace.sql` in the Supabase SQL editor (do not rewrite 0001–0007).
2. Sign in.
3. Settings → Workspace → **Load demo family data** (confirmation required).
4. **Open SMARAN Demo Family**. Banner: `DEMO WORKSPACE — All family health records shown here are fictional.`
5. **Use my real family** returns to the non-demo membership.
6. **Reset demo dataset** deletes only that demo family’s child rows (confirmation required).
7. **Schedule 2-minute demo test reminder** writes a real `reminders` row in the demo family (`seed_key = rem-demo-test`).

Idempotency: `families.demo_seed_version` + unique `(family_id, seed_key)`. Repeat load reuses.

Auth: `/api/demo` requires a signed-in user. RPCs `ensure_demo_family`, `set_active_family`, `reset_demo_family_records` are `security definer` and check `auth.uid()`.

### Isolation / duplicate fix

- Appointments no longer auto-open the in-memory sample preview when the live vault is empty.
- Document charts no longer fall back to hardcoded BP/glucose series when live data is empty.
- Documents dashboard no longer injects SAMPLE_HISTORY / SAMPLE_VACCINES into an empty real family.
- Ask uses `loadAuthorizedFamily` for the **active** workspace (includes medicines + history).

### Reminders

Existing in-app engine unchanged. `vercel.json` still has `* * * * *` → `/api/cron/reminders`. **Hosted cron is not verified** against a live Vercel project in this session. Browser timer is not the source of truth.

### Claude / OCR

Still deferred. Demo documents are labelled sample extraction fixtures. Real uploads keep honest extract status.

### Commands this pass

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run lint` | **0** | |
| `npm test` | **0** | **215 passed**, **4 skipped** |
| `git diff --check` | **0** | |
| `npm run build` | **0** | includes `/api/demo` |

Seeding against the remote Supabase project was **not** executed here (migration 0008 not applied remotely in this session).

---


## Wispr Flow composer width collapse (this pass)

### Root cause

The shared composer sat in a ~292px inner rail (`Screen` aside `w-[340px]` + `px-6`, Today `320px` column). Header used a single flex row and showed `Powered by Wispr Flow` at the viewport `sm:` breakpoint, so a 1440px desktop still treated the 292px rail as “wide”. The pill (~170px) plus the 48px logo left almost no track for “Ask SMARAN” and the helper copy, which wrapped into one-word / few-character columns. The input used the same one-row flex: attachment + `field-sizing-content` textarea + `Use Wispr Flow` + send. The button ate the row; `field-sizing-content` then grew a tall, narrow field with an internal scrollbar.

### Fix (shared composer + parent rail only)

- Header: `grid-cols-[48px_minmax(0,1fr)]`. Pill stacks under the title unless the **composer container** is ≥420px (`@[420px]/composer`).
- Input: full-width textarea (`w-full min-w-0 min-h-[72px]`) on its own row; actions wrap below. Auto-grow; overflow-y only after the max height.
- `Screen` right rail starts at `xl` (not `lg`) and uses `min-w-0` + tighter padding. Below `xl` the aside stays in the main column. Today already did this.
- Container-width rules in `src/lib/wispr-flow-layout.ts` (stack actions below 400px).

Logo, submit handler, section policy, and medical examples are unchanged. No microphone. Input starts empty.

### Files

- `src/components/smaran/wispr-flow-composer.tsx`
- `src/components/shell/screen.tsx`
- `src/lib/wispr-flow-layout.ts`
- `src/lib/wispr-flow-layout.test.ts`
- `docs/verification-report.md`

### Viewports actually captured (headless Chrome → `/today` and `/ask`)

| Width | Result |
|---|---|
| 320 | Today header/schedule OK; composer is below the fold on Today. `/ask` sometimes still on boot splash (virtual-time). |
| 360, 375, 430 | Today captured. `/ask` at **430**: header stacks, helper wraps by word, textarea spans the card, Wispr + send sit on the row below. No one-character column. |
| 768 | Today captured; no squeezed rail. |
| 1024 | Today: **no** desktop right rail (aside stays in the column). Main content uses the full width beside the sidebar. |
| 1280, 1440 | Today rail: title + pill readable, textarea full card width, actions below the field. `/ask` 1440: pill top-right, textarea wide, no overlap. |

Narrow-rail case is the 1440 Today aside (~320px), not a second invented card.

Typing/submit were not re-clicked in Chrome (handlers unchanged; existing composer tests still pass). Horizontal overflow was not visible on the captured viewports.

### Commands this pass

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run lint` | **0** | |
| `npm test` | **0** | **204 passed**, **4 skipped** |
| `git diff --check` | **0** | |
| `npm run build` | **0** | Next.js 16.4.2 |

---

## Shared Wispr Flow composer (prior pass)

One reusable composer (`WisprFlowComposer` + `WISPR_SECTIONS` policy) on Today, Medicines, Appointments, Documents, Health Card, Ask SMARAN, and Settings. Logo is `/brand/wispr-flow.png`. No microphone button. No Claude. No new migration.

Cross-section writes are blocked before execution (e.g. Medicines cannot create appointments). Today no longer saves appointments. Settings only accepts preference phrases.

Windows / Mac / phone shortcut copy is shown when **Use Wispr Flow** is clicked. The browser still does not record audio.

Supabase writes were **not** live-tested in this environment.

### Commands that pass (composer policy)

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run lint` | **0** | |
| `npm test` | **0** | **200 passed**, **4 skipped** (then); **204** after layout tests |
| `git diff --check` | **0** | |
| `npm run build` | **0** | |

---

## In-app reminder system (prior pass)

Persistent, time-based **in-app** reminders. No phone, SMS, WhatsApp, email, or browser-push delivery. Hosted cron is **not verified** on a live Vercel/Supabase project in this session.

### How it works

1. A caregiver saves a reminder (Today / Medicines / `POST /api/reminders`). Recipients are care people (Mummy, Papa), not login accounts. The author is `created_by`.
2. Due time is the stored `Asia/Kolkata` local stamp compared to the **real clock** (`localStampToUtcMs` ≤ now). Alerts do not fire early. Minute resolution is honest.
3. `GET /api/cron/reminders` (Bearer `CRON_SECRET` when set) generates `reminder_occurrences`, inserts one `in_app_notifications` row per occurrence (unique), and logs `reminder_delivery_attempts` with `in_app:{occurrenceId}`.
4. While the app is open, the bell polls `/api/reminders/inbox` (signed-in) and also runs a local processor for device-local rows. A toast shows once per notification id (`sessionStorage`).
5. If the browser was closed, the due row is still persisted by the worker (when service role + cron actually run). Reopening shows it in the centre with the original scheduled time and an overdue label after 60 minutes. A closed tab cannot show a live banner.
6. Acknowledge / dismiss ≠ medicine taken. Snooze is +10 minutes on the same occurrence. Skip is this occurrence only. Complete records actor + timestamp.

### Files

- `src/lib/in-app-reminders.ts` + `.test.ts` — clock-controlled engine (20 required cases).
- `supabase/migrations/0007_in_app_notifications.sql` — new table, unique occurrence time, RLS.
- `src/lib/server/in-app-processor.ts` — service-role due processor.
- `src/app/api/cron/reminders/route.ts`, `/api/reminders/inbox`, `/api/reminders/status`.
- `src/components/shell/notification-center.tsx` — bell, badge, filters, toast.
- `vercel.json` — `* * * * *` → `/api/cron/reminders`.

### Scheduler configuration status

| Check | This environment |
|---|---|
| Processor code | Present |
| `CRON_SECRET` / service role on this VM | Not treated as configured for live hosting |
| `vercel.json` cron | Committed; Vercel Hobby may reject minute crons |
| Host actually running the job | **Not verified** |
| Two-account RLS live | **Not verified** |

Settings → Notifications shows this honestly. In-app banners can be disabled; rows still persist. Reminder sound is not implemented. Browser push is not requested.

### Commands this pass

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | After restoring `@/components/screens` re-exports |
| `npm run lint` | **0** | |
| `npm test` | **0** | **183 passed**, **4 skipped** |
| `git diff --check` | **0** | |
| `npm run build` | **0** | `/api/cron/reminders`, `/api/reminders/inbox`, `/api/reminders/status` |

---

## Settings dashboard (prior pass)

Compact two-column Settings control center. No new migration. Identity colours persist in `settings.memberColors` and are reapplied after vault refresh.

- Left: About me, Family members (add/edit + colour), Voice & language, Wispr Flow.
- Right: Notifications (honest browser/server status), Family account (existing auth), Data & demo (isolated sample preview vs local restore vs consent copy), App preferences.
- Spoken assistant playback and family invites are labelled unavailable.
- Session email is returned only when Supabase `getUser()` provides it.

### Commands this pass

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run lint` | **0** | |
| `npm test` | **0** | **162 passed**, **4 skipped** |
| `git diff --check` | **0** | |
| `npm run build` | **0** | `/settings` |

---

## Family Appointments sample preview (prior pass)

Reference-matched Appointments workspace plus an isolated fictional sample preview. No migration. Fixtures never write to Supabase, reminders, or Health Cards.

- Sample fixtures live in `src/lib/demo/appointment-fixtures.ts` with `fixture-*` IDs and `source: "sample"`.
- Empty live lists open sample preview automatically. Real records stay on live data; users can still enter/leave sample preview.
- Sample clock is Sunday 25 October 2026. Live mode uses Asia/Kolkata `calendarToday()`.
- New appointment still uses the real form/`saveAppointment`/`createCloudAppointment` and leaves sample preview after a confirmed write.
- Wispr examples prefill only. In sample preview, submit says nothing was saved.

### Commands this pass

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run lint` | **0** | |
| `npm test` | **0** | **155 passed**, **4 skipped** |
| `git diff --check` | **0** | |
| `npm run build` | **0** | `/appointments` |

---

## Family Appointments redesign (prior pass)

Premium Appointments workspace on the existing models (`saveAppointment`, `scheduleFollowUp`, `upsertDoctor`, `/api/appointments`). No new migration. Today’s weekly calendar is unchanged.

- Header: **Family Appointments** / “Every visit, every doctor, every follow-up.” plus Add doctor and **+ New appointment**.
- Summary cards (Upcoming, Awaiting follow-up, Past visits) use live counts and open the matching tab. Past visits count only `status === "completed"`.
- Tabs: Calendar (default), Upcoming (Today / Tomorrow / This week / Later from Asia/Kolkata), Past visits (needs-review vs completed), Follow-ups, Doctors (primary vs specialist).
- Independent Monday-first month grid (`monthGridMonday`). Cancelled-only days have no ordinary visit dot. Agenda heading uses `formatFullDate`. Compact empty state: “No visits on this day.”
- Wispr rail stays on `/appointments` (`stayOnPage`). Examples prefill only. Ambiguous captures ask for missing fields. Confirmed captures save through `saveAppointment`.
- Duplicate cards: still deduped by appointment id; identical create retries merge (`merged: true`). Sample doctors stay labeled sample.
- No Claude. No schema change.

### Commands this pass

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run lint` | **0** | |
| `npm test` | **0** | **144 passed**, **4 skipped** |
| `git diff --check` | **0** | |
| `npm run build` | **0** | `/appointments` |

Not verified live: phone notification delivery, two-account RLS, Claude.

---

## Ask SMARAN composer — Wispr Flow logo (prior pass)

Focused Ask composer update only. The overlapping brown circular microphone-style button is gone.

- Logo is the existing `public/brand/wispr-flow.png` via `WisprFlowMark` (`/brand/wispr-flow.png`), in a compact light-peach rounded control. No invert, no large brown circle.
- Always-visible heading **Use Wispr Flow for better speech-to-text** and support: “Speak naturally in Wispr Flow. Your words will appear in this box — review and send them to Ask SMARAN.”
- Clicking the logo focuses the textarea and shows an honest hint: dictate with Wispr Flow on the device; SMARAN does not record audio. No listening state, no fake transcript, no auto-submit.
- Flex row: attach · textarea · send. Enter submits, Shift+Enter newline. Placeholder unchanged. Draft starts empty.
- Helper sits above the input card (not inside an overflow-clipped pill). `dockComposer` lifts the footer above the mobile tab bar so the card is not cropped.
- Chat column, Try asking rail, bubbles, APIs, and other pages unchanged.

### Commands this pass

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run lint` | **0** | |
| `npm test` | **0** | **142 passed**, **4 skipped** |
| `npm run build` | **0** | `/ask` |

HTTP: `GET /ask` **200**, `GET /brand/wispr-flow.png` **200** on the local preview server.

---

## Documents dashboard (prior pass)

Documents & Reports is a person-centered health-vault dashboard: identity header, four summary cards, separate BP and glucose charts, medical history, category document rows, vaccination schedule, library, and a right Wispr Flow / recent / upcoming rail.

- Live cards and charts use saved records when present (`bpSeries` / `glucoseSeries`, sample rows excluded).
- Empty live charts show isolated fictional fixtures with **Sample demo — values are fictional.** They never write to `health_measurements` or Health Card.
- `Try sample BP/glucose report` reviews and updates only demo preview state.
- Wispr panel uses `WisprFlowInput` + `POST /api/ask`. Examples fill only. No Claude.
- Print uses the existing Health Card share page when a person is selected.
- No new migration.

### Commands this pass

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run lint` | **0** | |
| `npm test` | **0** | **141 passed**, **4 skipped** |
| `git diff --check` | **0** | |
| `npm run build` | **0** | `/documents` |

Not verified live: OCR/vision, Claude, two-account Storage RLS, browser print.

---

## Ask SMARAN chat (prior pass)

Ask SMARAN is a WhatsApp-style conversation. Global sidebar is unchanged. Retrieval is still `answerQuestion` via `POST /api/ask` (rule-based, `claudeUsed: false`).

- Center chat: greeting with profile name, family filter chips from `state.family`, assistant bot avatar, peach user bubbles, source-linked result cards.
- Bottom composer: paperclip → existing `/documents/upload`, Wispr Flow control focuses the box (no browser recording claim), Enter submits / Shift+Enter newline.
- Right **Try asking** panel (mobile: expandable). Suggestions use the same `/api/ask` path. Upload suggestion routes to Documents.
- Papa questions never return Mummy's readings when the filter mismatches.
- Missing records stay empty. Failed API requests keep the local grounded answer and an error, not a fabricated success.

### Commands this pass

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run lint` | **0** | |
| `npm test` | **0** | **140 passed**, **4 skipped** |
| `git diff --check` | **0** | |
| `npm run build` | **0** | `/ask`, `/api/ask` |

Not verified live: Ask against a signed-in Supabase vault, Wispr desktop dictation, two-account RLS.

---

## Documents & Reports scanner (prior pass)

The Documents page is a person-centered library. Filters and counts come from stored documents. Sample family notes stay labelled.

- Header: **Documents & Reports** — “Prescriptions, reports, scans and medical records — organized by person.” Primary **+ Add document**.
- Person chips from `state.family` with identity colours. Category and extraction-status filters with stored counts. Sort: newest / oldest / title.
- Cards show title, person, category, dates, extract status, linked readings/visits.
- Scanner panel: upload (existing flow), honest “scan extraction is not configured yet” for images, local selectable-PDF text extract via `/api/documents/extract` + `extractPdfText` / `parseLabText`.
- Review on document detail: accept BP (systolic/diastolic) or glucose; HbA1c stays separate; identity must be confirmed when the printed name mismatches.
- Confirmed readings call `confirmDocumentMeasurement` → one linked `health_measurements` row → Health Record charts via `bpSeries` / `glucoseSeries`.
- **Try BP report demo** / **Try glucose report demo** use isolated fixtures (`document-demo.ts`). Badge: “Sample demo — not a real patient record.” They do not write family measurements.
- No new migration. Existing `documents.extract_status` / `extracted_text` reused. Claude was not integrated.

### Commands this pass

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run lint` | **0** | |
| `npm test` | **0** | **136 passed**, **4 skipped** |
| `git diff --check` | **0** | |
| `npm run build` | **0** | `/documents`, `/documents/upload`, `/api/documents/extract` |

Not verified live: OCR/vision, Claude extract, two-account Storage RLS, uploading a real multi-page PDF in the browser.

---

## Family Health Record (prior pass)

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
