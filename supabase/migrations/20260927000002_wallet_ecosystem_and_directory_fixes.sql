-- Migration: 20260927000002_wallet_ecosystem_and_directory_fixes.sql
-- Description: Auto-create customer wallet with $1,000.00 Demo Welcome Bonus, ensure realtime, and refresh schema

-- 1. Function: Auto create customer wallet with $1,000 demo welcome bonus
CREATE OR REPLACE FUNCTION public.handle_customer_wallet_creation()
RETURNS TRIGGER AS $$
DECLARE
    new_wallet_id UUID;
BEGIN
    -- Only trigger for customer profiles
    IF NEW.role = 'customer' OR NEW.role = 'user' THEN
        -- Check if wallet already exists
        IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id = NEW.id) THEN
            INSERT INTO public.wallets (id, user_id, balance, promo_credits, currency)
            VALUES (gen_random_uuid(), NEW.id, 1000.00, 50.00, 'USD')
            RETURNING id INTO new_wallet_id;

            -- Log Welcome Bonus transaction
            INSERT INTO public.transactions (wallet_id, user_id, type, amount, status, description, metadata)
            VALUES (
                new_wallet_id,
                NEW.id,
                'deposit',
                1000.00,
                'completed',
                'Demo Welcome Bonus - Instant Credits',
                jsonb_build_object('source', 'welcome_bonus', 'auto_credited', true)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger on profiles insert
DROP TRIGGER IF EXISTS tr_customer_wallet_creation ON public.profiles;
CREATE TRIGGER tr_customer_wallet_creation
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_customer_wallet_creation();

-- 3. Backfill/Top-up existing customer profiles with $1,000 demo bonus if wallet missing
DO $$
DECLARE
    prof RECORD;
    w_id UUID;
BEGIN
    FOR prof IN SELECT id FROM public.profiles WHERE role IN ('customer', 'user') LOOP
        IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id = prof.id) THEN
            INSERT INTO public.wallets (id, user_id, balance, promo_credits, currency)
            VALUES (gen_random_uuid(), prof.id, 1000.00, 50.00, 'USD')
            RETURNING id INTO w_id;

            INSERT INTO public.transactions (wallet_id, user_id, type, amount, status, description, metadata)
            VALUES (
                w_id,
                prof.id,
                'deposit',
                1000.00,
                'completed',
                'Demo Welcome Bonus - Instant Credits',
                jsonb_build_object('source', 'welcome_bonus', 'backfilled', true)
            );
        END IF;
    END LOOP;
END $$;

-- 4. Ensure realtime publication covers wallets and transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'wallets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;
END $$;

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
