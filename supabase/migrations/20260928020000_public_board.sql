-- Remove sign-in: the board is public. Anyone with the app link (the anon key)
-- can view, add, edit and delete jobs. The sign-in tables (members, invites),
-- their triggers and the "added by / updated by" columns are dropped.

-- ─── Sign-in triggers and tables ──────────────────────────────────────────────

drop trigger if exists enforce_invite_on_signup on auth.users;
drop trigger if exists create_member_for_new_user on auth.users;

drop policy if exists "members read jobs"  on public.jobs;
drop policy if exists "members add jobs"   on public.jobs;
drop policy if exists "members edit jobs"  on public.jobs;
drop policy if exists "owners delete jobs" on public.jobs;

alter table public.jobs drop column if exists added_by, drop column if exists updated_by;

drop table if exists public.invites;
drop table if exists public.members;

drop function if exists public.enforce_invite_on_signup();
drop function if exists public.create_member_for_new_user();
drop function if exists public.activate_existing_user_on_invite();
drop function if exists public.deactivate_member_on_uninvite();
drop function if exists public.guard_member_update();
drop function if exists public.normalize_invite();
drop function if exists public.is_member();
drop function if exists public.is_owner();

-- ─── Job stamping without users ───────────────────────────────────────────────

create or replace function public.stamp_job()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.applied_at := case when new.applied then now() else null end;
  else
    new.created_at := old.created_at;
    if new.applied is distinct from old.applied then
      new.applied_at := case when new.applied then now() else null end;
    else
      new.applied_at := old.applied_at;
    end if;
  end if;
  new.updated_at := now();
  new.title := btrim(new.title);
  new.company := btrim(new.company);
  new.location := btrim(new.location);
  new.apply_url := btrim(new.apply_url);
  return new;
end;
$$;

-- ─── Public access ────────────────────────────────────────────────────────────

grant select, insert, update, delete on public.jobs to anon;

create policy "public read jobs"   on public.jobs for select to anon, authenticated using (true);
create policy "public add jobs"    on public.jobs for insert to anon, authenticated with check (true);
create policy "public edit jobs"   on public.jobs for update to anon, authenticated using (true) with check (true);
create policy "public delete jobs" on public.jobs for delete to anon, authenticated using (true);
