-- Add multi-party chat columns to chat_messages
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS participant_role text DEFAULT 'customer',
ADD COLUMN IF NOT EXISTS channel_type text DEFAULT 'professional';

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
