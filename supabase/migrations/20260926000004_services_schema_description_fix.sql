-- Migration: Add missing description, category, image_url, and icon columns to services table

-- 1. Alter services table to add missing columns
alter table if exists public.services
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists image_url text,
  add column if not exists icon text;

-- 2. Backfill sample descriptions and icons for existing standard services
update public.services
set 
  description = coalesce(description, 'Professional, certified on-demand ' || name || ' service with upfront pricing.'),
  category = coalesce(category, 'Home Maintenance'),
  icon = coalesce(icon, case 
    when lower(name) like '%plumb%' then '🚰'
    when lower(name) like '%electr%' then '⚡'
    when lower(name) like '%clean%' then '✨'
    when lower(name) like '%paint%' then '🎨'
    when lower(name) like '%carpenter%' or lower(name) like '%wood%' then '🪚'
    when lower(name) like '%ac%' or lower(name) like '%hvac%' then '❄️'
    else '🔧'
  end)
where description is null or icon is null or category is null;

-- 3. Notify PostgREST to reload schema cache immediately
notify pgrst, 'reload schema';
