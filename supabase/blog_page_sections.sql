-- ============================================================
-- KitDB Blog Page Builder (optional)
-- Run in Supabase SQL Editor
-- ============================================================

create table if not exists public.blog_page_sections (
  id uuid default uuid_generate_v4() primary key,
  type text not null, -- featured_story | latest_grid | trending_list | newsletter_cta
  label text not null,
  is_active boolean default true,
  sort_order integer default 0,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

with ranked as (
  select
    id,
    row_number() over (
      partition by type
      order by sort_order asc, created_at asc, id asc
    ) as row_num
  from public.blog_page_sections
)
delete from public.blog_page_sections d
using ranked r
where d.id = r.id
  and r.row_num > 1;

create unique index if not exists blog_page_sections_type_key
  on public.blog_page_sections(type);

insert into public.blog_page_sections (type, label, is_active, sort_order, settings) values
('featured_story', 'Featured Story', true, 1, '{"title":"Featured Story"}'),
('latest_grid',    'Latest News Grid', true, 2, '{"title":"Latest News","limit":9}'),
('trending_list',  'Trending Posts', false, 3, '{"title":"Trending Posts","limit":5}'),
('newsletter_cta', 'Newsletter CTA', false, 4, '{"title":"Subscribe to Blog Updates","subtitle":"Get the latest kit stories and updates in your inbox.","button_text":"Subscribe"}')
on conflict (type) do update
set
  label = excluded.label,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  settings = excluded.settings,
  updated_at = now();

alter table public.blog_page_sections enable row level security;

drop policy if exists "Blog page sections viewable by all" on public.blog_page_sections;
create policy "Blog page sections viewable by all"
  on public.blog_page_sections for select using (true);

drop policy if exists "Admins manage blog page sections" on public.blog_page_sections;
create policy "Admins manage blog page sections"
  on public.blog_page_sections for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
