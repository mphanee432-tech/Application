-- Migration: Add missing description, category, and image_url columns to services table

alter table if exists public.services
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists image_url text,
  add column if not exists icon text;

-- Backfill sample descriptions, categories, and icons for services
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

-- Reload PostgREST schema cache immediately
notify pgrst, 'reload schema';

