-- Reminder schedules stay on public.reminders / reminder_occurrences.
-- Delivery attempts are a separate log so a failed push does not rewrite the schedule.

create table if not exists public.reminder_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.reminder_occurrences (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  channel text not null check (channel in ('in_app', 'web_push', 'email')),
  status text not null check (status in ('queued', 'sent', 'failed', 'skipped')),
  idempotency_key text not null unique,
  attempt_number integer not null default 1,
  error text,
  created_at timestamptz not null default now()
);

alter table public.reminder_delivery_attempts enable row level security;

create policy reminder_delivery_all on public.reminder_delivery_attempts
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
