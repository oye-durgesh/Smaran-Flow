-- Structured medical history, vaccinations, diary, and measurement context.
-- Apply after 0005. Do not rewrite earlier migrations.

alter table public.health_measurements add column if not exists systolic numeric;
alter table public.health_measurements add column if not exists diastolic numeric;
alter table public.health_measurements add column if not exists glucose_context text;
alter table public.health_measurements add column if not exists custom_label text;
alter table public.health_measurements add column if not exists note text;

create table if not exists public.medical_history (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  recipient_id uuid not null references public.care_recipients (id),
  category text not null check (category in ('illness', 'chronic', 'surgery', 'hospitalization', 'family_history')),
  name text not null,
  status text,
  start_date date,
  end_date date,
  hospital text,
  relationship text,
  notes text,
  document_id uuid references public.documents (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  previous jsonb,
  is_sample boolean not null default false
);

create table if not exists public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  recipient_id uuid not null references public.care_recipients (id),
  name text not null,
  dose text,
  received_date date,
  next_due_date date,
  clinic text,
  document_id uuid references public.documents (id),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  is_sample boolean not null default false
);

create table if not exists public.health_diary (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  recipient_id uuid not null references public.care_recipients (id),
  title text not null,
  body text not null,
  recorded_at timestamptz not null default now(),
  appointment_id uuid references public.appointments (id),
  document_id uuid references public.documents (id),
  measurement_id uuid references public.health_measurements (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  is_sample boolean not null default false
);

alter table public.medical_history enable row level security;
alter table public.vaccinations enable row level security;
alter table public.health_diary enable row level security;

drop policy if exists medical_history_family_all on public.medical_history;
create policy medical_history_family_all on public.medical_history
  for all using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

drop policy if exists vaccinations_family_all on public.vaccinations;
create policy vaccinations_family_all on public.vaccinations
  for all using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

drop policy if exists health_diary_family_all on public.health_diary;
create policy health_diary_family_all on public.health_diary
  for all using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
