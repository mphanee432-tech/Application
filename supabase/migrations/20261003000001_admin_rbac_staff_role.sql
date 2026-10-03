-- Migration: 20261003000001_admin_rbac_staff_role.sql
-- Description: Implement strict Role-Based Access Control (RBAC) in the Admin app.
-- Default role for any new admin is 'staff', while phani9119@gmail.com is granted 'super_admin'.

-- 1. Ensure admins table exists and configure column defaults
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Drop any existing check constraint that restricts role values
ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS admins_role_check;

-- Add updated check constraint including 'staff' and 'super_admin'
ALTER TABLE public.admins ADD CONSTRAINT admins_role_check CHECK (role IN ('super_admin', 'staff', 'operations', 'admin', 'standard'));

ALTER TABLE public.admins ALTER COLUMN role SET DEFAULT 'staff';

-- 2. Configure Row Level Security (RLS) on public.admins
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view their own record" ON public.admins;
CREATE POLICY "Admins can view their own record"
  ON public.admins
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Super admins can view all admin records" ON public.admins;
CREATE POLICY "Super admins can view all admin records"
  ON public.admins
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admins a WHERE a.id = auth.uid() AND a.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Service role full access to admins" ON public.admins;
CREATE POLICY "Service role full access to admins"
  ON public.admins
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Designate phani9119@gmail.com as super_admin
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = 'phani9119@gmail.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    -- Ensure profile exists
    INSERT INTO public.profiles (id, full_name, email, role)
    VALUES (v_user_id, 'Super Admin', 'phani9119@gmail.com', 'admin')
    ON CONFLICT (id) DO UPDATE SET role = 'admin';

    -- Upsert super_admin role into admins
    INSERT INTO public.admins (id, role)
    VALUES (v_user_id, 'super_admin')
    ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
  END IF;
END $$;

-- 4. Demote any non-phani9119 existing admins to 'staff'
UPDATE public.admins
SET role = 'staff'
WHERE id NOT IN (
  SELECT id FROM auth.users WHERE lower(email) = 'phani9119@gmail.com'
);

