-- ============================================================
-- KitDB Schema v3 — Paste into Supabase SQL Editor > Run
-- Adds: blog, pages, SEO, homepage sections, site settings
-- ============================================================

-- ── BLOG POSTS ─────────────────────────────────────────────
create table if not exists public.blog_posts (
  id uuid default uuid_generate_v4() primary key,
  slug text unique not null,
  title text not null,
  excerpt text,
  content text,
  cover_image text,
  author_id uuid references public.profiles(id),
  is_published boolean default false,
  published_at timestamptz,
  -- SEO
  seo_title text,
  seo_description text,
  og_image text,
  -- tags
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── PAGES (About, Contact, Privacy, Terms, Custom) ─────────
create table if not exists public.pages (
  id uuid default uuid_generate_v4() primary key,
  slug text unique not null,
  title text not null,
  content text,
  is_published boolean default true,
  show_in_footer boolean default true,
  show_in_nav boolean default false,
  sort_order integer default 0,
  -- SEO
  seo_title text,
  seo_description text,
  og_image text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- default pages
insert into public.pages (slug, title, content, show_in_footer, sort_order) values
('about', 'About KitDB', '<h2>About KitDB</h2><p>KitDB is the world''s most complete football kit encyclopedia.</p>', true, 1),
('contact', 'Contact Us', '<h2>Contact</h2><p>Get in touch with the KitDB team.</p>', true, 2),
('privacy', 'Privacy Policy', '<h2>Privacy Policy</h2><p>Your privacy is important to us.</p>', true, 3),
('terms', 'Terms of Service', '<h2>Terms of Service</h2><p>By using KitDB you agree to these terms.</p>', true, 4)
on conflict (slug) do nothing;

-- ── HOMEPAGE SECTIONS ──────────────────────────────────────
create table if not exists public.homepage_sections (
  id uuid default uuid_generate_v4() primary key,
  type text not null, -- hero|featured_kits|latest_kits|blog_posts|kit_filter|content|gallery|newsletter|custom_html|banner
  label text not null,
  is_active boolean default true,
  sort_order integer default 0,
  settings jsonb default '{}', -- flexible config per section type
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- default sections
insert into public.homepage_sections (type, label, is_active, sort_order, settings) values
('hero',          'Hero Banner',          true,  1, '{"title":"THE WORLD''S KIT ARCHIVE","subtitle":"Browse, rate and collect football kits from every club and era.","cta_text":"Browse All Kits","cta_url":"/browse.html","show_search":true}'),
('banner',        'Announcement Banner',  false, 2, '{"text":"","bg_color":"#00C853","text_color":"#000000"}'),
('featured_kits', 'Featured Kits',        true,  3, '{"title":"Featured Kits","limit":5}'),
('latest_kits',   'Latest Additions',     true,  4, '{"title":"Latest Additions","limit":6}'),
('kit_filter',    'Kit Filter Section',   false, 5, '{"title":"Browse by League","filter_type":"league"}'),
('blog_posts',    'Latest from the Blog', false, 6, '{"title":"Latest News","limit":3}'),
('newsletter',    'Newsletter Signup',    false, 7, '{"title":"Stay Updated","subtitle":"Get the latest kit news in your inbox.","button_text":"Subscribe"}'),
('content',       'Content Block',        false, 8, '{"title":"","body":""}'),
('custom_html',   'Custom HTML Block',    false, 9, '{"html":""}')
on conflict do nothing;

-- ── SITE SETTINGS ──────────────────────────────────────────
create table if not exists public.site_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

insert into public.site_settings (key, value) values
('site_name',           'KitDB'),
('site_tagline',        'Football Kit Encyclopedia'),
('site_url',            'https://yoursite.com'),
('site_logo_url',       ''),
('favicon_url',         ''),
('global_seo_title',    'KitDB — Football Kit Encyclopedia'),
('global_seo_desc',     'Browse, rate and collect football kits from every club and era.'),
('global_og_image',     ''),
('google_analytics_id', ''),
('footer_text',         '© 2025 KitDB. All rights reserved.'),
('footer_links',        ''),
('social_twitter',      ''),
('social_instagram',    ''),
('social_facebook',     ''),
('contact_email',       ''),
('robots_txt',          'User-agent: *\nAllow: /'),
('custom_head_code',    ''),
('custom_body_code',    '')
on conflict (key) do nothing;

-- ── SEO OVERRIDES per kit ──────────────────────────────────
alter table public.kits add column if not exists seo_title text;
alter table public.kits add column if not exists seo_description text;
alter table public.kits add column if not exists og_image text;

-- ── RLS ────────────────────────────────────────────────────
alter table public.blog_posts enable row level security;
alter table public.pages enable row level security;
alter table public.homepage_sections enable row level security;
alter table public.site_settings enable row level security;

-- blog posts
create policy "Published posts viewable by all" on public.blog_posts for select using (is_published = true);
create policy "Admins manage blog posts" on public.blog_posts for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- pages
create policy "Published pages viewable by all" on public.pages for select using (is_published = true);
create policy "Admins manage pages" on public.pages for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- homepage sections
create policy "Homepage sections viewable by all" on public.homepage_sections for select using (true);
create policy "Admins manage homepage sections" on public.homepage_sections for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- site settings
create policy "Site settings viewable by all" on public.site_settings for select using (true);
create policy "Admins manage site settings" on public.site_settings for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ── SUPABASE STORAGE BUCKET ────────────────────────────────
-- Run this separately if bucket doesn't exist:
-- insert into storage.buckets (id, name, public) values ('kits', 'kits', true);

create policy "Kit images viewable by all" on storage.objects for select using (bucket_id = 'kits');
create policy "Admins can upload kit images" on storage.objects for insert
  with check (bucket_id = 'kits' and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Admins can delete kit images" on storage.objects for delete
  using (bucket_id = 'kits' and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
