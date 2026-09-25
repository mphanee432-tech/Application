-- Migration: 20260925000002_catalog_kyc_geolocation.sql
-- Description: Dynamic Catalog (cities, services, professional_skills), KYC Verification (storage bucket, kyc_status), and Geolocation (customer_addresses, coordinates).

-- 1. Cities Table
create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Services Table
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_price numeric(10, 2) not null default 50.00,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed Initial Cities
insert into public.cities (name, is_active)
values
  ('Metroville', true),
  ('New York', true),
  ('San Francisco', true),
  ('Chicago', true),
  ('Austin', true)
on conflict (name) do nothing;

-- Seed Initial Services
insert into public.services (name, base_price, is_active)
values
  ('Emergency Plumbing', 65.00, true),
  ('Electrical Repair', 75.00, true),
  ('Deep Home Cleaning', 95.00, true),
  ('HVAC Maintenance', 85.00, true),
  ('Carpentry & Framing', 60.00, true)
on conflict do nothing;

-- 3. Customer Addresses Table
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  address_line1 text not null,
  landmark text,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

-- 4. Update Professionals Table
alter table public.professionals
  add column if not exists city_id uuid references public.cities(id) on delete set null,
  add column if not exists is_online boolean not null default false,
  add column if not exists kyc_status text not null default 'pending_submission',
  add column if not exists kyc_document_path text;

-- Add check constraint for kyc_status if not exists
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'professionals_kyc_status_check'
  ) then
    alter table public.professionals
      add constraint professionals_kyc_status_check
      check (kyc_status in ('pending_submission', 'pending_approval', 'approved', 'rejected'));
  end if;
end $$;

-- Synchronize any existing approved professionals
update public.professionals
set kyc_status = 'approved'
where status = 'approved' and kyc_status = 'pending_submission';

-- 5. Professional Skills Join Table
create table if not exists public.professional_skills (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (professional_id, service_id)
);

-- 6. Update Bookings Table
alter table public.bookings
  add column if not exists city_id uuid references public.cities(id) on delete set null,
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

-- Backfill latitude / longitude from existing lat / lng
update public.bookings
set
  latitude = coalesce(latitude, lat),
  longitude = coalesce(longitude, lng)
where latitude is null or longitude is null;

-- Synchronize default city and service for existing bookings
do $$
declare
  v_default_city_id uuid;
  v_default_service_id uuid;
begin
  select id into v_default_city_id from public.cities limit 1;
  select id into v_default_service_id from public.services limit 1;

  if v_default_city_id is not null then
    update public.bookings set city_id = v_default_city_id where city_id is null;
  end if;
  if v_default_service_id is not null then
    update public.bookings set service_id = v_default_service_id where service_id is null;
  end if;
end $$;

-- 7. Supabase Storage: kyc-documents Bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760, -- 10MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760;

-- 8. Enable Row Level Security (RLS)
alter table public.cities enable row level security;
alter table public.services enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.professional_skills enable row level security;

-- 9. RLS Policies

-- Cities: Public & authenticated can read active cities; admins full access
drop policy if exists "Active cities are viewable by all" on public.cities;
create policy "Active cities are viewable by all"
  on public.cities for select
  to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "Admins can manage cities" on public.cities;
create policy "Admins can manage cities"
  on public.cities for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Services: Public & authenticated can read active services; admins full access
drop policy if exists "Active services are viewable by all" on public.services;
create policy "Active services are viewable by all"
  on public.services for select
  to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "Admins can manage services" on public.services;
create policy "Admins can manage services"
  on public.services for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Customer Addresses: Users can manage their own addresses; admins full access
drop policy if exists "Users can manage their own addresses" on public.customer_addresses;
create policy "Users can manage their own addresses"
  on public.customer_addresses for all
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Professional Skills: Pros manage their own skills; all authenticated can view
drop policy if exists "Professional skills viewable by authenticated users" on public.professional_skills;
create policy "Professional skills viewable by authenticated users"
  on public.professional_skills for select
  to authenticated
  using (true);

drop policy if exists "Professionals can manage own skills" on public.professional_skills;
create policy "Professionals can manage own skills"
  on public.professional_skills for all
  to authenticated
  using (professional_id = auth.uid() or public.is_admin())
  with check (professional_id = auth.uid() or public.is_admin());

-- Storage Policies for kyc-documents
drop policy if exists "Authenticated users can upload kyc documents" on storage.objects;
create policy "Authenticated users can upload kyc documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'kyc-documents');

drop policy if exists "Users and admins can view kyc documents" on storage.objects;
create policy "Users and admins can view kyc documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

drop policy if exists "Admins have full access to kyc documents" on storage.objects;
create policy "Admins have full access to kyc documents"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'kyc-documents' and public.is_admin())
  with check (bucket_id = 'kyc-documents' and public.is_admin());

-- 10. Grant Privileges
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

