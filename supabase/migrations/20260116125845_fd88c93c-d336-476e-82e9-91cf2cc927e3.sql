-- Add board_type column to registrations table
ALTER TABLE public.registrations 
ADD COLUMN board_type TEXT NOT NULL DEFAULT 'ISC' CHECK (board_type IN ('ISC', 'ICSE'));