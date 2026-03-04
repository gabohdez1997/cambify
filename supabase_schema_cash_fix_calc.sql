-- 1. Ensure the calculation function exists
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

-- 2. Ensure the trigger is attached to cash_movements
DROP TRIGGER IF EXISTS after_cash_movement_insert ON cash_movements;
CREATE TRIGGER after_cash_movement_insert
AFTER INSERT ON cash_movements
FOR EACH ROW
EXECUTE FUNCTION update_cash_session_balance();

-- 3. Enable Realtime Broadcasting for both tables so the Interface knows when to update
begin;
  -- remove the supabase_realtime publication
  drop publication if exists supabase_realtime;
  -- re-create the supabase_realtime publication with no tables
  create publication supabase_realtime;
commit;

-- add the tables to the publication
alter publication supabase_realtime add table cash_sessions;
alter publication supabase_realtime add table cash_movements;
