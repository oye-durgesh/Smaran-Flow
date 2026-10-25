-- Dedicated medication records, schedule history, and refill reminders.
-- Apply after 0003. Do not rewrite earlier migrations.

alter table public.reminders add column if not exists medicine_id uuid;
alter table public.reminders add column if not exists reminder_role text;

create table if not exists public.medicines (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  recipient_id uuid not null references public.care_recipients (id),
  name text not null,
  strength text,
  dosage text,
  route text,
  frequency text not null check (frequency in ('daily', 'twice_daily', 'weekly', 'as_needed', 'custom')),
  times text[] not null default '{}',
  start_date date not null,
  end_date date,
  ongoing boolean not null default false,
  status text not null check (status in ('active', 'paused', 'completed', 'stopped', 'archived')),
  prescriber text,
  instructions text,
  source text not null check (source in ('prescription', 'document', 'manual', 'other')),
  document_id uuid references public.documents (id),
  notes text,
  reminder_setup text not null check (reminder_setup in ('scheduled', 'paused', 'needs_setup')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_sample boolean not null default false
);

create table if not exists public.medicine_changes (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  summary text not null,
  previous jsonb,
  actor_id uuid references public.profiles (id),
  recorded_at timestamptz not null default now()
);

create table if not exists public.medicine_refills (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  medicine_id uuid not null references public.medicines (id) on delete cascade,
  recipient_id uuid not null references public.care_recipients (id),
  remaining_quantity numeric,
  unit text,
  units_per_dose numeric,
  planned_date date,
  reminder_date date,
  reminder_time time,
  status text not null check (status in ('upcoming', 'due', 'completed', 'snoozed', 'cancelled')),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reminders_medicine_id_fkey'
  ) then
    alter table public.reminders
      add constraint reminders_medicine_id_fkey
      foreign key (medicine_id) references public.medicines (id) on delete set null;
  end if;
end $$;

alter table public.medicines enable row level security;
alter table public.medicine_changes enable row level security;
alter table public.medicine_refills enable row level security;

drop policy if exists medicines_family_all on public.medicines;
create policy medicines_family_all on public.medicines
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists medicine_changes_family_all on public.medicine_changes;
create policy medicine_changes_family_all on public.medicine_changes
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists medicine_refills_family_all on public.medicine_refills;
create policy medicine_refills_family_all on public.medicine_refills
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
