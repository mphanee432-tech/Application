-- Migration: 20260926000007_in_job_addons.sql
-- Description: In-Job Upsell & Cross-Sell Add-ons Schema and RLS

CREATE TABLE IF NOT EXISTS public.job_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    custom_description TEXT,
    cost NUMERIC NOT NULL CHECK (cost >= 0),
    photo_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for performant querying of booking addons
CREATE INDEX IF NOT EXISTS idx_job_addons_booking ON public.job_addons (booking_id, status);

-- Enable RLS
ALTER TABLE public.job_addons ENABLE ROW LEVEL SECURITY;

-- Policy: Professionals can INSERT add-ons for their assigned bookings
DROP POLICY IF EXISTS "Professionals can insert add-ons for assigned bookings" ON public.job_addons;
CREATE POLICY "Professionals can insert add-ons for assigned bookings"
    ON public.job_addons FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bookings
            WHERE public.bookings.id = job_addons.booking_id
              AND public.bookings.professional_id = auth.uid()
        )
    );

-- Policy: Professionals can SELECT add-ons for their assigned bookings
DROP POLICY IF EXISTS "Professionals can view add-ons for assigned bookings" ON public.job_addons;
CREATE POLICY "Professionals can view add-ons for assigned bookings"
    ON public.job_addons FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings
            WHERE public.bookings.id = job_addons.booking_id
              AND public.bookings.professional_id = auth.uid()
        )
    );

-- Policy: Customers can SELECT add-ons for their own bookings
DROP POLICY IF EXISTS "Customers can view add-ons for own bookings" ON public.job_addons;
CREATE POLICY "Customers can view add-ons for own bookings"
    ON public.job_addons FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings
            WHERE public.bookings.id = job_addons.booking_id
              AND public.bookings.customer_id = auth.uid()
        )
    );

-- Policy: Customers can UPDATE (status) add-ons for their own bookings
DROP POLICY IF EXISTS "Customers can update status of add-ons for own bookings" ON public.job_addons;
CREATE POLICY "Customers can update status of add-ons for own bookings"
    ON public.job_addons FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings
            WHERE public.bookings.id = job_addons.booking_id
              AND public.bookings.customer_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bookings
            WHERE public.bookings.id = job_addons.booking_id
              AND public.bookings.customer_id = auth.uid()
        )
    );

-- Policy: Admins have full access
DROP POLICY IF EXISTS "Admins have full access to job_addons" ON public.job_addons;
CREATE POLICY "Admins have full access to job_addons"
    ON public.job_addons FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Policy: Service role full access
DROP POLICY IF EXISTS "Service role has full access to job_addons" ON public.job_addons;
CREATE POLICY "Service role has full access to job_addons"
    ON public.job_addons FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable Realtime on job_addons
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'job_addons'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.job_addons;
    END IF;
END $$;

-- Storage: Ensure proof-of-work allows authenticated uploads
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Professionals can upload proof of work'
    ) THEN
        CREATE POLICY "Professionals can upload proof of work"
            ON storage.objects FOR INSERT
            TO authenticated
            WITH CHECK (bucket_id = 'proof-of-work');
    END IF;
END $$;

-- Grants
GRANT ALL ON public.job_addons TO authenticated, service_role;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';

