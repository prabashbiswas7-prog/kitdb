-- ============================================================
-- KITDB — Supabase Schema
-- Paste this entire file into Supabase > SQL Editor > Run
-- ============================================================

-- EXTENSIONS
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  full_name text,
  country text,
  fav_club text,
  avatar_url text,
  role text not null default 'subscriber', -- 'subscriber' | 'admin'
  bio text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- KITS
-- ============================================================
create table public.kits (
  id uuid default uuid_generate_v4() primary key,
  slug text unique not null,
  team text not null,
  season text not null,
  league text,
  type text not null default 'Home', -- Home | Away | Third | GK | Special
  maker text,
  color text,
  description text,
  image_url text,
  image_url_2 text,
  image_url_3 text,
  buy_url text,           -- affiliate redirect link
  buy_label text default 'Buy Now',
  price_label text,       -- display only e.g. "From £89.95"
  is_featured boolean default false,
  is_published boolean default true,
  views integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- RATINGS
-- ============================================================
create table public.ratings (
  id uuid default uuid_generate_v4() primary key,
  kit_id uuid references public.kits(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(kit_id, user_id)
);

-- ============================================================
-- COLLECTIONS (saved kits)
-- ============================================================
create table public.collections (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  kit_id uuid references public.kits(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, kit_id)
);

-- ============================================================
-- AD SLOTS
-- ============================================================
create table public.ad_slots (
  id uuid default uuid_generate_v4() primary key,
  slot_key text unique not null, -- 'top_banner' | 'browse_grid' | 'sidebar' | 'kit_detail' | 'interstitial'
  label text not null,
  ad_code text,                  -- paste Google AdSense or any HTML ad code
  is_active boolean default true,
  updated_at timestamptz default now()
);

-- default ad slots
insert into public.ad_slots (slot_key, label, ad_code, is_active) values
  ('top_banner',    'Top Banner (all pages)',          '<!-- TOP BANNER AD CODE HERE -->',      false),
  ('browse_grid',   'Browse Grid (every 6 cards)',     '<!-- BROWSE GRID AD CODE HERE -->',     false),
  ('sidebar',       'Sidebar Ad',                      '<!-- SIDEBAR AD CODE HERE -->',         false),
  ('kit_detail',    'Kit Detail Page Ad',              '<!-- KIT DETAIL AD CODE HERE -->',      false),
  ('interstitial',  'Full Page Modal (after 6 clicks)','<!-- INTERSTITIAL AD CODE HERE -->',    false);

-- ============================================================
-- HOMEPAGE CONFIG
-- ============================================================
create table public.homepage_config (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

insert into public.homepage_config (key, value) values
  ('hero_title',       'THE WORLD''S KIT ARCHIVE'),
  ('hero_subtitle',    'Browse, rate and collect football kits from every club and era.'),
  ('hero_cta_text',    'Browse All Kits'),
  ('announcement',     ''),
  ('announcement_on',  'false'),
  ('featured_title',   'Featured Kits');

-- ============================================================
-- VIEWS TRACKING (anonymous)
-- ============================================================
create table public.kit_views (
  id uuid default uuid_generate_v4() primary key,
  kit_id uuid references public.kits(id) on delete cascade not null,
  viewed_at timestamptz default now()
);

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- kit with average rating + count
create or replace view public.kits_with_stats as
select
  k.*,
  coalesce(round(avg(r.rating)::numeric, 1), 0) as avg_rating,
  count(r.id)::integer as rating_count,
  count(distinct c.id)::integer as collection_count
from public.kits k
left join public.ratings r on r.kit_id = k.id
left join public.collections c on c.kit_id = k.id
group by k.id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.kits enable row level security;
alter table public.ratings enable row level security;
alter table public.collections enable row level security;
alter table public.ad_slots enable row level security;
alter table public.homepage_config enable row level security;
alter table public.kit_views enable row level security;

-- PROFILES
create policy "Public profiles viewable by all" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- KITS (public read, admin write)
create policy "Published kits viewable by all" on public.kits for select using (is_published = true);
create policy "Admins can do everything with kits" on public.kits for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- RATINGS
create policy "Ratings viewable by all" on public.ratings for select using (true);
create policy "Logged in users can insert rating" on public.ratings for insert with check (auth.uid() = user_id);
create policy "Users can update own rating" on public.ratings for update using (auth.uid() = user_id);
create policy "Users can delete own rating" on public.ratings for delete using (auth.uid() = user_id);

-- COLLECTIONS
create policy "Users can view own collection" on public.collections for select using (auth.uid() = user_id);
create policy "Users can add to collection" on public.collections for insert with check (auth.uid() = user_id);
create policy "Users can remove from collection" on public.collections for delete using (auth.uid() = user_id);

-- AD SLOTS (public read)
create policy "Ad slots viewable by all" on public.ad_slots for select using (true);
create policy "Admins manage ad slots" on public.ad_slots for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- HOMEPAGE CONFIG (public read)
create policy "Homepage config viewable by all" on public.homepage_config for select using (true);
create policy "Admins manage homepage config" on public.homepage_config for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- KIT VIEWS (insert only)
create policy "Anyone can log a view" on public.kit_views for insert with check (true);
create policy "Admins can read views" on public.kit_views for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'subscriber'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Increment kit view count
create or replace function public.increment_kit_views(kit_slug text)
returns void language plpgsql security definer as $$
begin
  update public.kits set views = views + 1 where slug = kit_slug;
  insert into public.kit_views (kit_id)
    select id from public.kits where slug = kit_slug;
end;
$$;

-- ============================================================
-- SEED: Sample Kits
-- ============================================================
insert into public.kits (slug, team, season, league, type, maker, color, description, image_url, buy_url, price_label, is_featured) values
('arsenal-home-2324', 'Arsenal FC', '2023/24', 'Premier League', 'Home', 'Adidas', 'Red & White', 'Classic red with white sleeves. Adidas three stripes on shoulders. White v-collar celebrating the club''s heritage.', '', '', 'From £89.95', true),
('arsenal-away-2324', 'Arsenal FC', '2023/24', 'Premier League', 'Away', 'Adidas', 'Yellow & Navy', 'Vibrant yellow away kit inspired by the iconic 1988 Adidas strip. Navy collar and cuffs.', '', '', 'From £89.95', false),
('liverpool-home-2425', 'Liverpool FC', '2024/25', 'Premier League', 'Home', 'Nike', 'Red', 'All red with cream accents. Nike Dri-FIT ADV technology with a unique tonal pattern.', '', '', 'From £89.95', true),
('manchester-city-home-2324', 'Manchester City', '2023/24', 'Premier League', 'Home', 'Puma', 'Sky Blue', 'Traditional sky blue with subtle tonal pinstripe. Clean minimal design for the Etihad.', '', '', 'From £84.95', true),
('real-madrid-home-2425', 'Real Madrid', '2024/25', 'La Liga', 'Home', 'Adidas', 'All White', 'Classic all-white with gold trim celebrating the 125th anniversary. Minimal crest design.', '', '', 'From €90.00', true),
('barcelona-home-2425', 'FC Barcelona', '2024/25', 'La Liga', 'Home', 'Nike', 'Blaugrana', 'Classic red-blue stripes with Catalan flag motif on the collar. Celebrating 125 years.', '', '', 'From €99.95', true),
('bayern-home-2425', 'Bayern Munich', '2024/25', 'Bundesliga', 'Home', 'Adidas', 'Red & White', 'Traditional red with white side panels. Ribbed crew collar. Bold Bundesliga look.', '', '', 'From €90.00', false),
('juventus-home-2324', 'Juventus', '2023/24', 'Serie A', 'Home', 'Adidas', 'Black & White', 'Iconic black-and-white stripes with pink Adidas logo detailing. Sharp modern design.', '', '', 'From €85.00', false),
('psg-home-2425', 'PSG', '2024/25', 'Ligue 1', 'Home', 'Nike', 'Navy & Red', 'Deep navy with red and gold horizontal hoop. Inspired by Haussmann architecture of Paris.', '', '', 'From €99.95', true),
('chelsea-home-2425', 'Chelsea FC', '2024/25', 'Premier League', 'Home', 'Nike', 'Royal Blue', 'Deep royal blue with silver graphic inspired by the 1970 FA Cup final shirt.', '', '', 'From £84.99', false);
