-- Create cash_sessions table (Jornadas Diarias)
CREATE TABLE cash_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opened_by UUID REFERENCES profiles(id) NOT NULL,
  closed_by UUID REFERENCES profiles(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  
  -- Legacy columns (can be ignored or dropped later)
  starting_balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_in NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_out NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  ending_balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,

  -- USD Balances
  starting_balance_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_in_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_out_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  ending_balance_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,

  -- VES Balances
  starting_balance_ves NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_in_ves NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_out_ves NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  ending_balance_ves NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

-- Enable RLS for cash_sessions
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

-- Both Users and Admins can view all sessions (transparency is usually needed to know if a session is open)
CREATE POLICY "Everyone can view cash sessions" 
ON cash_sessions FOR SELECT 
USING (true);

-- Any authenticated active user can open/close a session
CREATE POLICY "Active users can manage cash sessions" 
ON cash_sessions FOR INSERT 
WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'active')
);

CREATE POLICY "Active users can update cash sessions" 
ON cash_sessions FOR UPDATE 
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'active')
);


-- Create cash_movements table
CREATE TABLE cash_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES cash_sessions(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VES' CHECK (currency IN ('USD', 'VES')),
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for cash_movements
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

-- Everyone can view movements
CREATE POLICY "Everyone can view cash movements" 
ON cash_movements FOR SELECT 
USING (true);

-- Active users can insert movements
CREATE POLICY "Active users can insert cash movements" 
ON cash_movements FOR INSERT 
WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'active')
);

-- Note: Updates and Deletes on cash_movements are intentionally left out (no policies) to enforce immutability of financial records unless done by a superadmin directly in the DB.

-- Database Function: Calculate Session Balances Automatically
-- This function runs every time a movement is inserted to update the session's total_in, total_out and ending_balance per currency
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

-- Trigger to watch cash_movements inserts
CREATE TRIGGER after_cash_movement_insert
AFTER INSERT ON cash_movements
FOR EACH ROW
EXECUTE FUNCTION update_cash_session_balance();

-- Create exchange_rates table
CREATE TABLE exchange_rates (
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
