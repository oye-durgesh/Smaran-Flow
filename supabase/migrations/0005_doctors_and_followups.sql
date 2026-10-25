-- Doctor directory and appointment follow-up / visit fields.
-- Apply after 0004. Do not rewrite earlier migrations.

create table if not exists public.family_doctors (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null,
  specialty text,
  category text not null check (category in ('primary', 'specialist')),
  clinic text,
  address text,
  phone text,
  notes text,
  recipient_ids uuid[] not null default '{}',
  archived boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  is_sample boolean not null default false
);

alter table public.appointments add column if not exists doctor_id uuid references public.family_doctors (id);
alter table public.appointments add column if not exists doctor_category text;
alter table public.appointments add column if not exists specialty text;
alter table public.appointments add column if not exists clinic text;
alter table public.appointments add column if not exists purpose text;
alter table public.appointments add column if not exists follow_up_of_id uuid references public.appointments (id);
alter table public.appointments add column if not exists follow_up_date date;
alter table public.appointments add column if not exists follow_up_purpose text;
alter table public.appointments add column if not exists visit_summary jsonb;
alter table public.appointments add column if not exists reminder_offsets integer[] not null default '{1440,180}';

create unique index if not exists appointments_idempotent_upcoming
  on public.appointments (family_id, recipient_id, lower(doctor), local_date, local_time)
  where status = 'upcoming' and is_sample = false;

create index if not exists appointments_family_date_idx on public.appointments (family_id, local_date);

alter table public.family_doctors enable row level security;
drop policy if exists family_doctors_member_all on public.family_doctors;
create policy family_doctors_member_all on public.family_doctors
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
