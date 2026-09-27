-- Migration: Add foreign key for job_addons -> services and register tables in supabase_realtime publication

-- 1. Ensure required columns exist on job_addons
ALTER TABLE IF EXISTS public.job_addons
  ADD COLUMN IF NOT EXISTS service_id UUID,
  ADD COLUMN IF NOT EXISTS custom_description TEXT;

-- 2. Add foreign key constraint if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_addons_service'
  ) THEN
    ALTER TABLE public.job_addons
      ADD CONSTRAINT fk_job_addons_service
      FOREIGN KEY (service_id) REFERENCES public.services(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Ensure publication supabase_realtime includes sos_alerts, notifications, and job_addons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sos_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'job_addons'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_addons;
  END IF;
END $$;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
