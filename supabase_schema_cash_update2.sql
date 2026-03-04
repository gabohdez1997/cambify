-- ==============================================================================
-- UPDATE SCRIPT 2: Run this in Supabase SQL Editor to apply latest changes
-- ==============================================================================

-- Make description optional (drop NOT NULL constraint)
ALTER TABLE cash_movements ALTER COLUMN description DROP NOT NULL;

-- Change default currency to VES
ALTER TABLE cash_movements ALTER COLUMN currency SET DEFAULT 'VES';
