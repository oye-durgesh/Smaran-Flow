# SMARAN verification report

Date: 25 Oct 2026, Asia/Kolkata. Branch `main`. **No push, no deploy, no secrets committed.**

This report does not treat “code exists” as “it works.” Live Supabase, Claude, OCR, two-account RLS, and push remain unverified in this environment.

---

## 1. What this phase changed

Single source of truth and authentication foundation:

- Server session uses `supabase.auth.getUser()` plus `family_memberships`. No stub JWT.
- Family records load through the user-scoped Supabase client and RLS (`is_family_member`). The service role key is server-only and never `NEXT_PUBLIC_`.
- Authenticated UI hydrates appointments, reminders, measurements, documents, memory, and care recipients from `GET /api/vault`. Browser `localStorage` is kept as a **separate** device copy and is never auto-deleted.
- Device-local mode is explicit when URL/anon keys are missing. The chrome banner and Settings copy say so. Browser data is not labeled as cloud-synced.
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
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public (anon) | User-scoped client / RLS |
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

1. Apply migrations 0001–0003 on a Supabase project. Put URL + anon key in `.env.local`. Restart the app.
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
