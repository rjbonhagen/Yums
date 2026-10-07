-- Preserve legacy rows while enforcing constraints on new writes/updates.
-- Review legacy violations before approval or validating this constraint.
begin;
alter table public.user_reported_events drop constraint if exists reports_content_limits;
alter table public.user_reported_events add constraint reports_content_limits check (
  char_length(btrim(title)) between 1 and 160
  and (description is null or char_length(description) <= 2000)
  and (location_name is null or char_length(location_name) <= 160)
  and (source_url is null or (
    char_length(source_url) <= 2048 and source_url ~* '^https?://[^[:space:]]+$'
    and source_url !~* '^https?://[^/]*@'
  ))
) not valid;
commit;
