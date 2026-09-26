-- Migration: Fix KYC column id_proof_url, Realtime publication for professionals, and professional_skills DELETE RLS policy

-- 1. Ensure id_proof_url exists on professionals table and backfill from kyc_document_path
alter table public.professionals add column if not exists id_proof_url text;

update public.professionals
set id_proof_url = kyc_document_path
where id_proof_url is null and kyc_document_path is not null;

-- 2. Add professionals to supabase_realtime publication for instant client-side KYC approval sync
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'professionals'
  ) then
    alter publication supabase_realtime add table public.professionals;
  end if;
end $$;

-- 3. Explicit RLS policies on professional_skills join table (DELETE, INSERT, UPDATE, SELECT)
alter table public.professional_skills enable row level security;

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

drop policy if exists "Professionals can manage own skills" on public.professional_skills;

-- 4. Relax kyc_status check constraint to support 'pending', 'pending_submission', 'pending_approval', 'approved', 'rejected'
alter table public.professionals drop constraint if exists professionals_kyc_status_check;
alter table public.professionals add constraint professionals_kyc_status_check
  check (kyc_status in ('pending', 'pending_submission', 'pending_approval', 'approved', 'rejected'));

-- 5. Notify PostgREST to reload schema cache immediately
notify pgrst, 'reload schema';

