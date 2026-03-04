-- ==============================================================================
-- UPDATE SCRIPT: Run this in Supabase SQL Editor to upgrade the existing schema
-- ==============================================================================

-- 1. Create exchange_rates table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  ves_to_usd NUMERIC(10, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for exchange_rates
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Policies for exchange_rates
CREATE POLICY "Everyone can view exchange rates" 
ON exchange_rates FOR SELECT 
USING (true);

CREATE POLICY "Active users can insert exchange rates" 
ON exchange_rates FOR INSERT 
WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'active')
);

CREATE POLICY "Active users can update exchange rates" 
ON exchange_rates FOR UPDATE 
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'active')
);

-- 2. Modify cash_sessions to support dual currency
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS starting_balance_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS total_in_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS total_out_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS ending_balance_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS starting_balance_ves NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS total_in_ves NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS total_out_ves NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS ending_balance_ves NUMERIC(10, 2) NOT NULL DEFAULT 0.00;

-- 3. Modify cash_movements to include currency
ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'VES'));

-- 4. Recreate Database Function for dual currency balances
DROP TRIGGER IF EXISTS after_cash_movement_insert ON cash_movements;
DROP FUNCTION IF EXISTS update_cash_session_balance();

CREATE OR REPLACE FUNCTION update_cash_session_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.currency = 'USD' THEN
        IF NEW.type = 'in' THEN
            UPDATE cash_sessions
            SET total_in_usd = total_in_usd + NEW.amount,
                ending_balance_usd = ending_balance_usd + NEW.amount
            WHERE id = NEW.session_id;
        ELSIF NEW.type = 'out' THEN
            UPDATE cash_sessions
            SET total_out_usd = total_out_usd + NEW.amount,
                ending_balance_usd = ending_balance_usd - NEW.amount
            WHERE id = NEW.session_id;
        END IF;
    ELSIF NEW.currency = 'VES' THEN
        IF NEW.type = 'in' THEN
            UPDATE cash_sessions
            SET total_in_ves = total_in_ves + NEW.amount,
                ending_balance_ves = ending_balance_ves + NEW.amount
            WHERE id = NEW.session_id;
        ELSIF NEW.type = 'out' THEN
            UPDATE cash_sessions
            SET total_out_ves = total_out_ves + NEW.amount,
                ending_balance_ves = ending_balance_ves - NEW.amount
            WHERE id = NEW.session_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Re-attach the Trigger
CREATE TRIGGER after_cash_movement_insert
AFTER INSERT ON cash_movements
FOR EACH ROW
EXECUTE FUNCTION update_cash_session_balance();
