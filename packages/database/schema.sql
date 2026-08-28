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

create table stores (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  chain text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores (id),
  name text not null,
  unit text,
  protein_grams numeric(6, 2),
  calories numeric(6, 2),
  created_at timestamptz not null default now()
);

create table product_prices (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products (id),
  price numeric(10, 2) not null,
  unit_price numeric(10, 2),
  observed_at timestamptz not null default now()
);

create table grocery_lists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users (id) on delete cascade,
  name text not null default 'This week',
  created_at timestamptz not null default now()
);

create table grocery_list_items (
  id uuid primary key default uuid_generate_v4(),
  grocery_list_id uuid references grocery_lists (id) on delete cascade,
  product_id uuid references products (id),
  quantity numeric(6, 2) not null default 1,
  created_at timestamptz not null default now()
);

create table meal_plans (
  user_id uuid primary key references users (id) on delete cascade,
  meal_swipes_remaining int not null default 0,
  dining_dollars_remaining numeric(10, 2) not null default 0,
  days_left_in_term int not null default 0,
  updated_at timestamptz not null default now()
);

create table recommendations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users (id) on delete cascade,
  kind text not null check (kind in ('free_food', 'deal', 'grocery', 'dining')),
  ref_id uuid, -- points at events.id / deals.id / grocery_lists.id depending on kind
  title text not null,
  subtitle text,
  estimated_savings numeric(10, 2) not null default 0,
  distance_minutes int,
  start_time timestamptz,
  source_url text,
  score numeric(6, 4) not null default 0,
  created_at timestamptz not null default now()
);

-- Row Level Security: users only see their own preferences/lists/plans/recs.
alter table users enable row level security;
alter table user_preferences enable row level security;
alter table grocery_lists enable row level security;
alter table grocery_list_items enable row level security;
alter table meal_plans enable row level security;
alter table recommendations enable row level security;

create policy "users manage own row" on users
  for all using (auth.uid() = id);
create policy "users manage own preferences" on user_preferences
  for all using (auth.uid() = user_id);
create policy "users manage own grocery lists" on grocery_lists
  for all using (auth.uid() = user_id);
create policy "users manage own grocery list items" on grocery_list_items
  for all using (
    exists (
      select 1 from grocery_lists
      where grocery_lists.id = grocery_list_items.grocery_list_id
        and grocery_lists.user_id = auth.uid()
    )
  );
create policy "users manage own meal plan" on meal_plans
  for all using (auth.uid() = user_id);
create policy "users manage own recommendations" on recommendations
  for all using (auth.uid() = user_id);

-- Seed: one university for the MVP.
insert into universities (name, slug, latitude, longitude)
values ('UC San Diego', 'ucsd', 32.8801, -117.2340)
on conflict (slug) do nothing;
