-- Campus Savings Agent - initial schema (V1 / MVP)
-- Target: Supabase (Postgres). Run via `supabase db push` or the SQL editor.

create extension if not exists "uuid-ossp";

create table universities (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  university_id uuid references universities (id),
  created_at timestamptz not null default now()
);

-- Mirrors every new Supabase auth user (magic-link sign-in, see
-- apps/web/src/app/login) into public.users, so the FK on
-- user_preferences/recommendations has a row to point at
-- immediately after signup — without this, the first
-- savePreferencesToSupabase() call for a brand-new user fails the FK
-- constraint. security definer is required because auth.users insert
-- happens outside any authenticated session's RLS context.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- The invited pilot uses email accounts. Other Auth identities can exist
  -- in the project without a usable pilot profile.
  if new.email is null or btrim(new.email) = '' then return new; end if;
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Auth accounts can predate installation of the app schema. Keep existing
-- profiles intact and create only missing email-account profiles.
insert into public.users (id, email)
select id, email from auth.users
where email is not null and btrim(email) <> ''
on conflict (id) do nothing;

create table user_preferences (
  user_id uuid primary key references users (id) on delete cascade,
  weekly_budget numeric(10, 2) not null default 60,
  dietary_preferences text[] not null default '{}',
  transportation text not null default 'walking'
    check (transportation in ('walking', 'bike', 'car', 'transit')),
  max_travel_minutes int not null default 20,
  optimize_for text not null default 'cheapest'
    check (optimize_for in ('cheapest', 'healthy', 'high_protein', 'fast', 'custom')),
  save_money_vs_time numeric(3, 2) not null default 0.3, -- 0 = save money, 1 = save time
  updated_at timestamptz not null default now()
);

create table event_sources (
  id uuid primary key default uuid_generate_v4(),
  university_id uuid references universities (id),
  name text not null,
  adapter_key text not null, -- matches a CampusEventSource implementation key
  url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default uuid_generate_v4(),
  university_id uuid references universities (id),
  source_id uuid references event_sources (id),
  organization text not null,
  title text not null,
  description text,
  food text,
  start_time timestamptz not null,
  end_time timestamptz,
  location_name text,
  latitude double precision,
  longitude double precision,
  source_url text not null,
  confidence_score numeric(3, 2) not null default 0.5,
  created_at timestamptz not null default now()
);

create table businesses (
  id uuid primary key default uuid_generate_v4(),
  university_id uuid references universities (id),
  name text not null,
  category text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create table deals (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses (id),
  description text not null,
  discount_type text not null
    check (discount_type in ('percentage', 'fixed', 'bogo', 'student', 'other')),
  estimated_savings numeric(10, 2),
  start_time timestamptz,
  expiration_time timestamptz,
  source_url text,
  created_at timestamptz not null default now()
);

-- Google Calendar connection for real schedule-awareness (replaces the
-- flat scheduleScore placeholder in packages/shared/optimizer.ts). Tokens
-- come from Supabase's Google OAuth provider (see /login and
-- apps/web/src/app/auth/callback) with the calendar.freebusy scope — a
-- user must explicitly connect, this is never on by default. access_token
-- is short-lived; refresh_token lets the app request a new one without
-- another consent screen (see apps/web/src/lib/google-calendar.ts).
create table calendar_connections (
  user_id uuid primary key references users (id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- Doubles as the saved/favorited-items table (see
-- apps/web/src/lib/saved-items.ts) — a signed-in user "saving" a
-- recommendation from /feed inserts a denormalized snapshot of it here
-- (title/subtitle/coordinates/etc. at save time), since the live
-- free-food event or OSM place it came from won't necessarily still be
-- returned by buildRecommendations() later (an event's date passes, an
-- OSM query returns different results). ref_id is unused by any current
-- app code but kept for a future live-events-table integration.
create table recommendations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users (id) on delete cascade,
  save_key text not null,
  -- Must match packages/shared/types.ts's RecommendationKind union exactly.
  kind text not null check (kind in ('free_food', 'nearby_eats')),
  ref_id uuid, -- points at events.id / deals.id depending on kind
  title text not null,
  subtitle text,
  estimated_savings numeric(10, 2) not null default 0,
  distance_minutes int,
  start_time timestamptz,
  end_time timestamptz,
  source_url text,
  latitude double precision,
  longitude double precision,
  score numeric(6, 4) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, save_key)
);

-- Crowdsourced free-food reports (see apps/web/src/lib/reported-events.ts)
-- — a deliberately separate table from events/event_sources rather than
-- folding these into the automated ingestion pipeline, so a user's
-- unverified tip can never be mistaken for (or silently merged with) a
-- live-source event. Shown on /feed in its own clearly-labeled
-- "Community reports (unverified)" section, never scored/ranked
-- alongside the live sources.
create table user_reported_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users (id) on delete cascade,
  title text not null,
  description text,
  location_name text,
  latitude double precision,
  longitude double precision,
  start_time timestamptz not null,
  source_url text,
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  constraint reports_content_limits check (
    char_length(btrim(title)) between 1 and 160
    and (description is null or char_length(description) <= 2000)
    and (location_name is null or char_length(location_name) <= 160)
    and (source_url is null or (
      char_length(source_url) <= 2048 and source_url ~* '^https?://[^[:space:]]+$'
      and source_url !~* '^https?://[^/]*@'
    ))
  ),
  created_at timestamptz not null default now()
);

-- Row Level Security: users only see their own preferences/recs;
-- user_reported_events is publicly readable (a shared community list,
-- same visibility as the live free-food feed) but only the submitting
-- user can modify or delete their own report.
alter table users enable row level security;
alter table user_preferences enable row level security;
alter table recommendations enable row level security;
alter table calendar_connections enable row level security;
alter table user_reported_events enable row level security;
alter table universities enable row level security;
alter table event_sources enable row level security;
alter table events enable row level security;
alter table businesses enable row level security;
alter table deals enable row level security;

-- Catalog data is public to read; writes require a privileged operator.
create policy "public read" on universities for select using (true);
create policy "public read" on event_sources for select using (true);
create policy "public read" on events for select using (true);
create policy "public read" on businesses for select using (true);
create policy "public read" on deals for select using (true);

create policy "users manage own row" on users
  for all using (auth.uid() = id);
create policy "users manage own preferences" on user_preferences
  for all using (auth.uid() = user_id);
create policy "users manage own recommendations" on recommendations
  for all using (auth.uid() = user_id);
create policy "users manage own calendar connection" on calendar_connections
  for all using (auth.uid() = user_id);
create policy "anyone can view reported events" on user_reported_events
  for select using (moderation_status = 'approved' or auth.uid() = user_id);
create policy "signed-in users can submit reports" on user_reported_events
  for insert with check (auth.uid() = user_id and moderation_status = 'pending');
create policy "users manage own reports" on user_reported_events
  for update using (auth.uid() = user_id and moderation_status = 'pending')
  with check (auth.uid() = user_id and moderation_status = 'pending');
create policy "users delete own reports" on user_reported_events
  for delete using (auth.uid() = user_id);

-- Seed: one university for the MVP.
insert into universities (name, slug, latitude, longitude)
values ('UC Berkeley', 'berkeley', 37.8719, -122.2585)
on conflict (slug) do nothing;
