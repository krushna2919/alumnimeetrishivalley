-- Drop the existing check constraint on tshirt_size
ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_tshirt_size_check;

-- Update existing records with full t-shirt size descriptions
UPDATE public.registrations SET tshirt_size = 'S (Chest: 36")' WHERE tshirt_size = 'S';
UPDATE public.registrations SET tshirt_size = 'M (Chest: 38-40")' WHERE tshirt_size = 'M';
UPDATE public.registrations SET tshirt_size = 'L (Chest: 42")' WHERE tshirt_size = 'L';
UPDATE public.registrations SET tshirt_size = 'XL (Chest: 44")' WHERE tshirt_size = 'XL';

-- Add new check constraint with full t-shirt size descriptions
ALTER TABLE public.registrations ADD CONSTRAINT registrations_tshirt_size_check 
CHECK (tshirt_size IN ('S (Chest: 36")', 'M (Chest: 38-40")', 'L (Chest: 42")', 'XL (Chest: 44")'));