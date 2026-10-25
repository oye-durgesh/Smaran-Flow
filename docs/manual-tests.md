# Manual test guide

Do not paste API keys into chat.

## Wispr Flow (desktop)

1. Focus a SMARAN text box (Today or Medicines).
2. Invoke Wispr Flow with your system control.
3. Speak, wait until the transcript appears in the box, review it, press Send once.
4. Expected: the full transcript is visible before send; one interpretation; empty box only after the next review step accepts it.
5. Click a rotating example: it fills the box and does not submit.

## Without `ANTHROPIC_API_KEY`

- `/api/interpret` still returns a structured draft from the local parser (`provider: "rules"`, `claudeUsed: false`).
- The UI must not claim Claude processed the text.

## With `ANTHROPIC_API_KEY` in `.env.local` (never committed)

1. Restart `npm run dev`.
2. Send `Papa ka BP aaj 128/82 tha.`
3. Confirm the measurement. Reload. The Health Card shows a new history row.

## Backend / push

- Cross-family auth and real web-push are **blocked** until `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and VAPID keys are set.
- `GET /api/cron/reminders` reports `status: "blocked"` and `delivered: 0` when those are missing.

## Appointments

- Unique: `Papa ka appointment ho gaya` → confirm complete on the existing row.
- Ambiguous: two Papa appointments → clarification, no new appointment.
- Cancel from the appointment detail button requires the same persist path.

## Documents

- Upload a small text PDF with `x-smaran-consent: cloud-extract` via `/api/documents/extract`.
- Scanned images without a key fail honestly. No fake 100% “read successfully.”
