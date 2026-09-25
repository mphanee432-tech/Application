-- Migration: 20260925000003_job_execution_reviews.sql
-- Description: Job execution lifecycle ('arrived'), proof-of-work storage bucket, and two-way reviews table.

-- 1. Update bookings status constraint to include 'arrived'
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled'));

-- 2. Add proof_photos column to bookings
alter table public.bookings
  add column if not exists proof_photos jsonb default '{"before": null, "after": null}'::jsonb;

-- 3. Create reviews table
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- 4. Supabase Storage Bucket: proof-of-work
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proof-of-work',
  'proof-of-work',
  true,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760;

-- 5. Enable Row Level Security
alter table public.reviews enable row level security;

-- 6. RLS Policies for reviews
drop policy if exists "Reviews are viewable by authenticated users" on public.reviews;
create policy "Reviews are viewable by authenticated users"
  on public.reviews for select
  to authenticated
  using (true);

drop policy if exists "Users and professionals can insert their own reviews" on public.reviews;
create policy "Users and professionals can insert their own reviews"
  on public.reviews for insert
  to authenticated
  with check (auth.uid() = reviewer_id or public.is_admin());

drop policy if exists "Admins can manage all reviews" on public.reviews;
create policy "Admins can manage all reviews"
  on public.reviews for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 7. Storage Policies for proof-of-work bucket
drop policy if exists "Professionals can upload proof of work" on storage.objects;
create policy "Professionals can upload proof of work"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'proof-of-work');

drop policy if exists "Proof of work photos are viewable by all authenticated" on storage.objects;
create policy "Proof of work photos are viewable by all authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'proof-of-work');

drop policy if exists "Admins have full access to proof of work" on storage.objects;
create policy "Admins have full access to proof of work"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'proof-of-work' and public.is_admin())
  with check (bucket_id = 'proof-of-work' and public.is_admin());

-- 8. Grant Privileges
grant usage on schema public to anon, authenticated, service_role;
grant all on public.reviews to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
