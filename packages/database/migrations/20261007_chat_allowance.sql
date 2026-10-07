-- Atomic, persistent per-account limits across server instances.
begin;
create table if not exists public.chat_usage (
  user_id uuid not null references public.users(id) on delete cascade,
  usage_date date not null,
  requests integer not null default 0 check (requests between 0 and 20),
  last_request_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);
alter table public.chat_usage enable row level security;
-- No client table policies: only the function can increment usage.
create or replace function public.consume_chat_allowance()
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller uuid := auth.uid();
begin
  if caller is null then return false; end if;
  insert into public.chat_usage (user_id, usage_date, requests, last_request_at)
    values (caller, (now() at time zone 'UTC')::date, 1, now())
  on conflict (user_id, usage_date) do update
    set requests = chat_usage.requests + 1, last_request_at = now()
    where chat_usage.requests < 20
      and chat_usage.last_request_at <= now() - interval '5 seconds';
  return found;
end;
$$;
revoke all on function public.consume_chat_allowance() from public;
grant execute on function public.consume_chat_allowance() to authenticated;
commit;
