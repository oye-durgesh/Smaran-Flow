-- Repair ensure_own_family: families.created_by points at public.profiles.
-- If handle_new_user did not create a profile, family insert failed with families_created_by_fkey.

create or replace function public.ensure_own_family()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  display text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(nullif(u.raw_user_meta_data->>'display_name', ''), split_part(coalesce(u.email, 'Family member'), '@', 1))
    into display
  from auth.users u
  where u.id = auth.uid();

  insert into public.profiles (id, display_name)
  values (auth.uid(), coalesce(display, 'Family member'))
  on conflict (id) do nothing;

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
