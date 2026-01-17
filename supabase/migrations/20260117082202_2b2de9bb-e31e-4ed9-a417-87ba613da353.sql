-- Drop the existing check constraint on board_type to allow custom values
ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_board_type_check;

-- Add new check constraint that allows ISC, ICSE, or any custom value (Other: prefix)
-- Since we want to allow any custom board name, we'll just ensure it's not empty
ALTER TABLE public.registrations ADD CONSTRAINT registrations_board_type_check 
CHECK (length(board_type) >= 1);