-- Isolated SMARAN Demo Family workspace. Do not rewrite earlier migrations.
-- Apply in the Supabase SQL editor after 0007.

alter table public.families add column if not exists is_demo boolean not null default false;
alter table public.families add column if not exists demo_seed_version integer;
alter table public.families add column if not exists demo_reference_date date;

alter table public.profiles add column if not exists active_family_id uuid references public.families (id);

alter table public.care_recipients add column if not exists age integer;
alter table public.care_recipients add column if not exists color_key text;
alter table public.care_recipients add column if not exists seed_key text;

alter table public.appointments add column if not exists seed_key text;
alter table public.reminders add column if not exists seed_key text;
alter table public.health_measurements add column if not exists seed_key text;
alter table public.documents add column if not exists seed_key text;
alter table public.documents add column if not exists category text;
alter table public.documents add column if not exists report_date date;
alter table public.documents add column if not exists preview_text text;
alter table public.medicines add column if not exists seed_key text;
alter table public.medicine_refills add column if not exists seed_key text;
alter table public.family_doctors add column if not exists seed_key text;
alter table public.medical_history add column if not exists seed_key text;
alter table public.vaccinations add column if not exists seed_key text;
alter table public.health_diary add column if not exists seed_key text;
alter table public.memory_events add column if not exists seed_key text;

create unique index if not exists care_recipients_family_seed on public.care_recipients (family_id, seed_key) where seed_key is not null;
create unique index if not exists appointments_family_seed on public.appointments (family_id, seed_key) where seed_key is not null;
create unique index if not exists reminders_family_seed on public.reminders (family_id, seed_key) where seed_key is not null;
create unique index if not exists measurements_family_seed on public.health_measurements (family_id, seed_key) where seed_key is not null;
create unique index if not exists documents_family_seed on public.documents (family_id, seed_key) where seed_key is not null;
create unique index if not exists medicines_family_seed on public.medicines (family_id, seed_key) where seed_key is not null;
create unique index if not exists refills_family_seed on public.medicine_refills (family_id, seed_key) where seed_key is not null;
create unique index if not exists doctors_family_seed on public.family_doctors (family_id, seed_key) where seed_key is not null;
create unique index if not exists history_family_seed on public.medical_history (family_id, seed_key) where seed_key is not null;
create unique index if not exists vaccinations_family_seed on public.vaccinations (family_id, seed_key) where seed_key is not null;
create unique index if not exists diary_family_seed on public.health_diary (family_id, seed_key) where seed_key is not null;
create unique index if not exists memory_family_seed on public.memory_events (family_id, seed_key) where seed_key is not null;

-- Named unique constraints so PostgREST upserts can target family_id,seed_key.
do $$ begin
  alter table public.care_recipients add constraint care_recipients_family_seed_key unique (family_id, seed_key);
exception when duplicate_object then null; when unique_violation then null; end $$;

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
  select family_id into fid
  from public.family_memberships m
  join public.families f on f.id = m.family_id
  where m.user_id = auth.uid() and coalesce(f.is_demo, false) = false
  limit 1;
  if fid is not null then
    return fid;
  end if;
  select family_id into fid from public.family_memberships where user_id = auth.uid() limit 1;
  if fid is not null then
    return fid;
  end if;
  insert into public.families (name, created_by, is_demo) values ('My family', auth.uid(), false) returning id into fid;
  insert into public.family_memberships (family_id, user_id, role) values (fid, auth.uid(), 'owner');
  return fid;
end;
$$;

create or replace function public.ensure_demo_family()
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
  select m.family_id into fid
  from public.family_memberships m
  join public.families f on f.id = m.family_id
  where m.user_id = auth.uid() and f.is_demo = true
  limit 1;
  if fid is not null then
    return fid;
  end if;
  insert into public.families (name, created_by, is_demo, demo_seed_version)
  values ('SMARAN Demo Family', auth.uid(), true, 0)
  returning id into fid;
  insert into public.family_memberships (family_id, user_id, role) values (fid, auth.uid(), 'owner');
  return fid;
end;
$$;

create or replace function public.set_active_family(target uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.family_memberships
    where user_id = auth.uid() and family_id = target
  ) then
    raise exception 'FORBIDDEN';
  end if;
  update public.profiles set active_family_id = target where id = auth.uid();
  return target;
end;
$$;

create or replace function public.reset_demo_family_records()
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
  select m.family_id into fid
  from public.family_memberships m
  join public.families f on f.id = m.family_id
  where m.user_id = auth.uid() and f.is_demo = true
  limit 1;
  if fid is null then
    raise exception 'NO_DEMO_FAMILY';
  end if;
  delete from public.in_app_notifications where family_id = fid;
  delete from public.reminder_delivery_attempts where family_id = fid;
  delete from public.reminder_occurrences where family_id = fid;
  delete from public.health_diary where family_id = fid;
  delete from public.memory_events where family_id = fid;
  delete from public.vaccinations where family_id = fid;
  delete from public.medical_history where family_id = fid;
  delete from public.medicine_refills where family_id = fid;
  delete from public.medicine_changes where family_id = fid;
  delete from public.reminders where family_id = fid;
  delete from public.medicines where family_id = fid;
  delete from public.appointment_status_history where family_id = fid;
  delete from public.appointments where family_id = fid;
  delete from public.health_measurements where family_id = fid;
  delete from public.documents where family_id = fid;
  delete from public.family_doctors where family_id = fid;
  delete from public.care_notes where family_id = fid;
  delete from public.care_recipients where family_id = fid;
  update public.families set demo_seed_version = 0, demo_reference_date = null where id = fid;
  return fid;
end;
$$;

grant execute on function public.ensure_own_family() to authenticated;
grant execute on function public.ensure_demo_family() to authenticated;
grant execute on function public.set_active_family(uuid) to authenticated;
grant execute on function public.reset_demo_family_records() to authenticated;
