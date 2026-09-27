-- Migration: Ensure robust SELECT & CRUD RLS policies for professionals, cities, services, and professional_skills

-- 1. Enable RLS on core tables
alter table if exists public.professionals enable row level security;
alter table if exists public.cities enable row level security;
alter table if exists public.services enable row level security;
alter table if exists public.professional_skills enable row level security;

-- 2. Cities RLS policies (Readable by all authenticated and anonymous users, manageable by admin)
drop policy if exists "Cities readable by everyone" on public.cities;
create policy "Cities readable by everyone"
  on public.cities for select
  to public
  using (true);

-- 3. Services RLS policies (Readable by all authenticated and anonymous users, manageable by admin)
drop policy if exists "Services readable by everyone" on public.services;
create policy "Services readable by everyone"
  on public.services for select
  to public
  using (true);

-- 4. Professionals RLS policies
-- Professionals can read their own profile, admins can read all, customers can read approved providers
drop policy if exists "Professionals viewable by authenticated users" on public.professionals;
drop policy if exists "Professionals can view own profile" on public.professionals;
create policy "Professionals can view own profile"
  on public.professionals for select
  to authenticated
  using (id = auth.uid() or public.is_admin() or status = 'approved');

drop policy if exists "Professionals can update own profile" on public.professionals;
create policy "Professionals can update own profile"
  on public.professionals for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "Professionals can insert own profile" on public.professionals;
create policy "Professionals can insert own profile"
  on public.professionals for insert
  to authenticated
  with check (id = auth.uid() or public.is_admin());

-- 5. Professional Skills RLS policies
drop policy if exists "Professional skills viewable by authenticated users" on public.professional_skills;
create policy "Professional skills viewable by authenticated users"
  on public.professional_skills for select
  to authenticated
  using (true);

drop policy if exists "Professionals can delete own skills" on public.professional_skills;
create policy "Professionals can delete own skills"
  on public.professional_skills for delete
  to authenticated
  using (professional_id = auth.uid() or public.is_admin());

drop policy if exists "Professionals can insert own skills" on public.professional_skills;
create policy "Professionals can insert own skills"
  on public.professional_skills for insert
  to authenticated
  with check (professional_id = auth.uid() or public.is_admin());

drop policy if exists "Professionals can update own skills" on public.professional_skills;
create policy "Professionals can update own skills"
  on public.professional_skills for update
  to authenticated
  using (professional_id = auth.uid() or public.is_admin())
  with check (professional_id = auth.uid() or public.is_admin());

-- 6. Reload schema cache
notify pgrst, 'reload schema';

