-- Migration: Enable realtime publication and replica identity for dynamic state sync tables

-- 1. Ensure publication supabase_realtime includes all dynamic state sync tables safely
DO $$
BEGIN
  -- notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  -- job_addons
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'job_addons'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_addons;
  END IF;

  -- chat_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;

  -- ticket_replies
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ticket_replies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_replies;
  END IF;

  -- sos_alerts
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sos_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
  END IF;

  -- bookings
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;
END $$;

-- 2. Set REPLICA IDENTITY FULL so payload.old contains complete row information on UPDATE and DELETE
ALTER TABLE IF EXISTS public.job_addons REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.notifications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.ticket_replies REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.sos_alerts REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.bookings REPLICA IDENTITY FULL;

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
