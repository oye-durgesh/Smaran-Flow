-- Completes family vault: actor history, notes, memory, RLS, storage, first-family bootstrap.
-- Apply in Supabase SQL after 0001. Do not run against production without review.

alter table public.families add column if not exists created_by uuid references public.profiles (id);
alter table public.appointments add column if not exists is_sample boolean not null default false;
alter table public.appointments add column if not exists location text;
alter table public.appointments add column if not exists notes text;
alter table public.reminders add column if not exists is_sample boolean not null default false;
alter table public.health_measurements add column if not exists is_sample boolean not null default false;
alter table public.documents add column if not exists is_sample boolean not null default false;
alter table public.documents add column if not exists name text;
alter table public.documents add column if not exists mime text;
alter table public.documents add column if not exists byte_size integer;

create table if not exists public.care_notes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  recipient_id uuid references public.care_recipients (id),
  body text not null,
  source_transcript text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  is_sample boolean not null default false
);

create table if not exists public.memory_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  recipient_id uuid references public.care_recipients (id),
  type text not null,
  title text not null,
  description text,
  ref_id uuid,
  actor_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  is_sample boolean not null default false
);

alter table public.appointment_status_history add column if not exists previous_status text;
alter table public.appointment_status_history add column if not exists note text;

create or replace function public.is_family_member(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_memberships m
    where m.family_id = fid and m.user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Family member'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.ensure_own_family()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select family_id into fid from public.family_memberships where user_id = auth.uid() limit 1;
  if fid is not null then
    return fid;
  end if;
  insert into public.families (name, created_by) values ('My family', auth.uid()) returning id into fid;
  insert into public.family_memberships (family_id, user_id, role) values (fid, auth.uid(), 'owner');
  return fid;
end;
$$;

grant execute on function public.ensure_own_family() to authenticated;
grant execute on function public.is_family_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.appointment_status_history enable row level security;
alter table public.reminder_occurrences enable row level security;
alter table public.care_notes enable row level security;
alter table public.memory_events enable row level security;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for select using (id = auth.uid() or exists (
    select 1 from public.family_memberships mine
    join public.family_memberships theirs on mine.family_id = theirs.family_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  ));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid());

drop policy if exists families_member_all on public.families;
create policy families_member_select_v2 on public.families
  for select using (public.is_family_member(id));

drop policy if exists families_member_select on public.families;

drop policy if exists memberships_rw on public.family_memberships;
create policy memberships_select on public.family_memberships
  for select using (public.is_family_member(family_id));
create policy memberships_insert_owner on public.family_memberships
  for insert with check (public.is_family_member(family_id));

create policy recipients_all on public.care_recipients
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy appointments_all on public.appointments
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy appointment_history_all on public.appointment_status_history
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy reminders_all on public.reminders
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy reminder_occ_all on public.reminder_occurrences
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy measurements_all on public.health_measurements
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy documents_all on public.documents
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy notes_all on public.care_notes
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy memory_all on public.memory_events
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

insert into storage.buckets (id, name, public)
values ('family-documents', 'family-documents', false)
on conflict (id) do nothing;

drop policy if exists family_docs_select on storage.objects;
create policy family_docs_select on storage.objects
  for select using (
    bucket_id = 'family-documents'
    and public.is_family_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists family_docs_insert on storage.objects;
create policy family_docs_insert on storage.objects
  for insert with check (
    bucket_id = 'family-documents'
    and public.is_family_member((storage.foldername(name))[1]::uuid)
  );
