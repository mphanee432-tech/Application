-- Migration: Add is_read columns to chat_messages and ticket_replies, and enable realtime

-- 1. Add is_read column to chat_messages
ALTER TABLE IF EXISTS public.chat_messages
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

-- 2. Add is_read column to ticket_replies
ALTER TABLE IF EXISTS public.ticket_replies
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

-- 3. Add chat_messages and ticket_replies to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ticket_replies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_replies;
  END IF;
END $$;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

