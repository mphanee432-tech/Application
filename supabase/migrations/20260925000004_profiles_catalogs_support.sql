-- Migration: 20260925000004_profiles_catalogs_support.sql
-- Description: Profiles contact updates, customer addresses multi-location, city-wise services pricing, and support tickets with threaded replies.

-- 1. Profiles & Professionals Contact Sync
alter table public.profiles add column if not exists mobile text;
update public.profiles set mobile = phone where mobile is null and phone is not null;

alter table public.professionals add column if not exists full_name text;
alter table public.professionals add column if not exists email text;
alter table public.professionals add column if not exists mobile text;

update public.professionals p
set full_name = pr.full_name,
    email = pr.email,
    mobile = coalesce(pr.mobile, pr.phone)
from public.profiles pr
where p.id = pr.id;

create or replace function public.handle_profile_sync_to_professional()
returns trigger as $$
begin
  update public.professionals
  set full_name = new.full_name,
      email = new.email,
      mobile = coalesce(new.mobile, new.phone)
  where id = new.id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_profile_update_sync_pro on public.profiles;
create trigger on_profile_update_sync_pro
  after update on public.profiles
  for each row
  execute function public.handle_profile_sync_to_professional();

-- 2. Customer Addresses Table & Multi-Location Support
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  address_line1 text not null,
  landmark text,
  lat double precision not null,
  lng double precision not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.customer_addresses add column if not exists is_default boolean not null default false;
alter table public.customer_addresses enable row level security;

drop policy if exists "Users can manage own addresses" on public.customer_addresses;
create policy "Users can manage own addresses"
  on public.customer_addresses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins full access to addresses" on public.customer_addresses;
create policy "Admins full access to addresses"
  on public.customer_addresses
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- 3. City-Wise Services Pricing Matrix
create table if not exists public.city_services (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  price numeric(10,2) not null check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(city_id, service_id)
);

alter table public.city_services enable row level security;

drop policy if exists "Anyone can read active city services" on public.city_services;
create policy "Anyone can read active city services"
  on public.city_services
  for select
  using (true);

drop policy if exists "Admins full access on city services" on public.city_services;
create policy "Admins full access on city services"
  on public.city_services
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seed initial city_services from existing cities and services
insert into public.city_services (city_id, service_id, price, is_active)
select c.id, s.id, s.base_price, true
from public.cities c
cross join public.services s
on conflict (city_id, service_id) do nothing;

-- 4. Centralized Support Tickets & Conversation Replies
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  creator_role text not null check (creator_role in ('user', 'professional')),
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('user', 'professional', 'admin')),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;
alter table public.ticket_replies enable row level security;

-- Support Tickets RLS
drop policy if exists "Creators can read own tickets" on public.support_tickets;
create policy "Creators can read own tickets"
  on public.support_tickets
  for select
  using (auth.uid() = creator_id or public.is_admin());

drop policy if exists "Creators can insert own tickets" on public.support_tickets;
create policy "Creators can insert own tickets"
  on public.support_tickets
  for insert
  with check (auth.uid() = creator_id);

drop policy if exists "Creators or Admins can update tickets" on public.support_tickets;
create policy "Creators or Admins can update tickets"
  on public.support_tickets
  for update
  using (auth.uid() = creator_id or public.is_admin())
  with check (auth.uid() = creator_id or public.is_admin());

drop policy if exists "Admins can delete tickets" on public.support_tickets;
create policy "Admins can delete tickets"
  on public.support_tickets
  for delete
  using (public.is_admin());

-- Ticket Replies RLS
drop policy if exists "Ticket participants can view replies" on public.ticket_replies;
create policy "Ticket participants can view replies"
  on public.ticket_replies
  for select
  using (
    public.is_admin() or
    exists (
      select 1 from public.support_tickets
      where id = ticket_replies.ticket_id and creator_id = auth.uid()
    )
  );

drop policy if exists "Ticket participants can insert replies" on public.ticket_replies;
create policy "Ticket participants can insert replies"
  on public.ticket_replies
  for insert
  with check (
    auth.uid() = sender_id and (
      public.is_admin() or
      exists (
        select 1 from public.support_tickets
        where id = ticket_replies.ticket_id and creator_id = auth.uid()
      )
    )
  );

-- Enable Realtime
do $$
begin
  alter publication supabase_realtime add table public.support_tickets;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ticket_replies;
exception when others then null;
end $$;
