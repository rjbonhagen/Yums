-- Run once on an existing database before using the updated cloud-save path.
-- Fresh databases use schema.sql, which already includes this constraint.
begin;
alter table public.recommendations add column if not exists save_key text;
update public.recommendations
set save_key = kind || '::' || coalesce(nullif(source_url, ''),
  title || '::' || coalesce(latitude::text, '') || ',' || coalesce(longitude::text, ''))
  || '::' || case when start_time is null then '' else
    to_char(start_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
where save_key is null;
-- Retain the newest snapshot when earlier repeated clicks created duplicates.
delete from public.recommendations where id in (
  select id from (
    select id, row_number() over (partition by user_id, save_key order by created_at desc, id desc) as position
    from public.recommendations
  ) duplicates where position > 1
);
alter table public.recommendations alter column save_key set not null;
create unique index if not exists recommendations_user_save_key
  on public.recommendations (user_id, save_key);
commit;
