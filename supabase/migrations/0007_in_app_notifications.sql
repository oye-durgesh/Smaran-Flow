-- In-app inbox rows. One notification per occurrence. Scheduler retries must not duplicate.
-- Does not rewrite 0001–0006.

create unique index if not exists reminder_occurrences_reminder_due
  on public.reminder_occurrences (reminder_id, due_at);

create table if not exists public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  occurrence_id uuid not null references public.reminder_occurrences (id) on delete cascade,
  reminder_id uuid not null references public.reminders (id) on delete cascade,
  recipient_id uuid not null references public.care_recipients (id),
  title text not null,
  scheduled_at timestamptz not null,
  timezone text not null default 'Asia/Kolkata',
  status text not null check (status in ('scheduled', 'due', 'acknowledged', 'snoozed', 'completed', 'skipped', 'missed', 'cancelled')),
  unread boolean not null default true,
  dose_outcome text not null default 'none' check (dose_outcome in ('none', 'taken', 'skipped', 'missed')),
  actor_id uuid references public.profiles (id),
  actor_at timestamptz,
  snooze_until timestamptz,
  created_at timestamptz not null default now(),
  unique (occurrence_id)
);

create index if not exists in_app_notifications_family_unread
  on public.in_app_notifications (family_id, unread, scheduled_at desc);

alter table public.in_app_notifications enable row level security;

create policy in_app_notifications_all on public.in_app_notifications
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
