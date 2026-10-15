-- Review against the existing project's Auth trigger before applying.
-- Requires the app's public.users table. Preserves existing profile rows.
begin;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is null or btrim(new.email) = '' then return new; end if;
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

insert into public.users (id, email)
select id, email from auth.users
where email is not null and btrim(email) <> ''
on conflict (id) do nothing;

commit;
