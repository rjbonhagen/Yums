-- Run after reviewing the existing schema. Existing reports enter review.
-- Only a privileged administrator can approve/reject reports; clients cannot.
begin;
alter table public.user_reported_events
  add column if not exists moderation_status text not null default 'pending'
  check (moderation_status in ('pending', 'approved', 'rejected'));

drop policy if exists "anyone can view reported events" on public.user_reported_events;
drop policy if exists "signed-in users can submit reports" on public.user_reported_events;
drop policy if exists "users manage own reports" on public.user_reported_events;
create policy "anyone can view reported events" on public.user_reported_events
  for select using (moderation_status = 'approved' or auth.uid() = user_id);
create policy "signed-in users can submit reports" on public.user_reported_events
  for insert with check (auth.uid() = user_id and moderation_status = 'pending');
create policy "users manage own reports" on public.user_reported_events
  for update using (auth.uid() = user_id and moderation_status = 'pending')
  with check (auth.uid() = user_id and moderation_status = 'pending');
commit;
