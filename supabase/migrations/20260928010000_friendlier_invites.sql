-- Make invites forgiving when added from the Supabase dashboard: emails with
-- capitals or stray spaces, and roles like "Owner", are normalised instead of
-- rejected by the check constraints.

create or replace function public.normalize_invite()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(btrim(new.email));
  new.role := lower(btrim(coalesce(new.role, 'member')));
  if new.email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Invite email "%" is not a valid email address.', new.email;
  end if;
  if new.role not in ('owner', 'member') then
    raise exception 'Invite role must be "owner" or "member" (got "%").', new.role;
  end if;
  return new;
end;
$$;

-- Runs before the check constraints and the primary-key check.
create trigger normalize_invite
  before insert or update on public.invites
  for each row execute function public.normalize_invite();
