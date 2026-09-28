-- Kittu's Job Board — schema, access rules and triggers.
--
-- Access model
--   * Only emails listed in public.invites can create an account (enforced by a
--     trigger on auth.users, so uninvited sign-ups are rejected by the database).
--   * An invited user becomes a row in public.members. Every read/write on jobs
--     requires an *active* member (Row-Level Security).
--   * Members can view, add and edit jobs. Only owners can delete jobs and
--     manage invites / collaborators.
--
-- Bootstrap: after running this migration, insert the owner's email:
--   insert into public.invites (email, role) values ('you@example.com', 'owner');

-- ─── Tables ────────────────────────────────────────────────────────────────────

create table public.invites (
  email       text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  role        text not null default 'member' check (role in ('owner', 'member')),
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.members (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  email         text not null unique,
  display_name  text not null,
  role          text not null default 'member' check (role in ('owner', 'member')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table public.jobs (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(btrim(title)) between 1 and 300),
  company      text not null check (char_length(btrim(company)) between 1 and 300),
  location     text not null default '' check (char_length(location) <= 300),
  description  text not null default '' check (char_length(description) <= 100000),
  apply_url    text not null check (apply_url ~* '^https?://[^\s/$.?#][^\s]*$' and char_length(apply_url) <= 2048),
  date_added   date not null default current_date,
  date_posted  date,
  salary       text not null default '' check (char_length(salary) <= 200),
  tags         text[] not null default '{}',
  notes        text not null default '' check (char_length(notes) <= 20000),
  applied      boolean not null default false,
  applied_at   timestamptz,
  irrelevant   boolean not null default false,
  added_by     uuid references public.members (user_id) on delete set null,
  updated_by   uuid references public.members (user_id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index jobs_newest_first_idx on public.jobs (date_added desc, created_at desc);

-- ─── Helper functions (security definer so RLS policies can call them) ────────

create or replace function public.is_member()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m where m.user_id = auth.uid() and m.active
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m where m.user_id = auth.uid() and m.active and m.role = 'owner'
  );
$$;

-- ─── Invite-only sign-up ──────────────────────────────────────────────────────

-- Runs before Supabase Auth creates a user. Uninvited emails are rejected.
create or replace function public.enforce_invite_on_signup()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is null or not exists (
    select 1 from public.invites i where i.email = lower(new.email)
  ) then
    raise exception 'This email has not been invited to the job board.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger enforce_invite_on_signup
  before insert on auth.users
  for each row execute function public.enforce_invite_on_signup();

-- After the user row exists, create their membership from the invite.
create or replace function public.create_member_for_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  inv public.invites%rowtype;
begin
  select * into inv from public.invites where email = lower(new.email);
  if found then
    insert into public.members (user_id, email, display_name, role)
    values (
      new.id,
      lower(new.email),
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
      inv.role
    )
    on conflict (user_id) do update set active = true, role = excluded.role;
  end if;
  return new;
end;
$$;

create trigger create_member_for_new_user
  after insert on auth.users
  for each row execute function public.create_member_for_new_user();

-- If someone is (re-)invited after they already have an account, (re)activate them.
create or replace function public.activate_existing_user_on_invite()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  u record;
begin
  select id, email, raw_user_meta_data into u from auth.users where lower(email) = new.email;
  if found then
    insert into public.members (user_id, email, display_name, role)
    values (
      u.id, new.email,
      coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
      new.role
    )
    on conflict (user_id) do update set active = true, role = excluded.role;
  end if;
  return new;
end;
$$;

create trigger activate_existing_user_on_invite
  after insert on public.invites
  for each row execute function public.activate_existing_user_on_invite();

-- Removing an invite revokes access (the member row is kept so "Added by" still resolves).
create or replace function public.deactivate_member_on_uninvite()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.members set active = false where email = old.email;
  return old;
end;
$$;

create trigger deactivate_member_on_uninvite
  after delete on public.invites
  for each row execute function public.deactivate_member_on_uninvite();

-- ─── Integrity triggers ───────────────────────────────────────────────────────

-- Members may edit their own display name; only owners change role/active,
-- and nobody can change their own role/active (prevents locking yourself out).
create or replace function public.guard_member_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new; -- service role / SQL editor
  end if;
  if new.user_id <> old.user_id or new.email <> old.email or new.created_at <> old.created_at then
    raise exception 'Cannot change member identity fields.';
  end if;
  if (new.role <> old.role or new.active <> old.active)
     and (not public.is_owner() or old.user_id = auth.uid()) then
    raise exception 'Only an owner can change another member''s role or access.';
  end if;
  return new;
end;
$$;

create trigger guard_member_update
  before update on public.members
  for each row execute function public.guard_member_update();

-- Stamp who added / last edited a job; keep added_by and created_at immutable.
create or replace function public.stamp_job()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.added_by := auth.uid();
    end if;
    new.created_at := now();
    new.applied_at := case when new.applied then now() else null end;
  else
    new.added_by := old.added_by;
    new.created_at := old.created_at;
    if new.applied is distinct from old.applied then
      new.applied_at := case when new.applied then now() else null end;
    else
      new.applied_at := old.applied_at;
    end if;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  new.title := btrim(new.title);
  new.company := btrim(new.company);
  new.location := btrim(new.location);
  new.apply_url := btrim(new.apply_url);
  return new;
end;
$$;

create trigger stamp_job
  before insert or update on public.jobs
  for each row execute function public.stamp_job();

-- ─── Row-Level Security ───────────────────────────────────────────────────────

alter table public.invites enable row level security;
alter table public.members enable row level security;
alter table public.jobs    enable row level security;

-- Anonymous visitors get nothing.
revoke all on public.invites, public.members, public.jobs from anon;

create policy "members read team"     on public.members for select to authenticated using (public.is_member());
create policy "members edit self"     on public.members for update to authenticated
  using (public.is_member() and user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners edit members"   on public.members for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "owners read invites"   on public.invites for select to authenticated using (public.is_owner());
create policy "owners create invites" on public.invites for insert to authenticated
  with check (public.is_owner() and invited_by = auth.uid());
create policy "owners delete invites" on public.invites for delete to authenticated
  using (public.is_owner() and email <> (select m.email from public.members m where m.user_id = auth.uid()));

create policy "members read jobs"     on public.jobs for select to authenticated using (public.is_member());
create policy "members add jobs"      on public.jobs for insert to authenticated with check (public.is_member());
create policy "members edit jobs"     on public.jobs for update to authenticated
  using (public.is_member()) with check (public.is_member());
create policy "owners delete jobs"    on public.jobs for delete to authenticated using (public.is_owner());

-- ─── Realtime (live updates between collaborators) ────────────────────────────

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.jobs;
  end if;
end;
$$;
