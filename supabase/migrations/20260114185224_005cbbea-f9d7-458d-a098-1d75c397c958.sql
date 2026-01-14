-- Add hostel_name column to registrations table for accommodation assignment
ALTER TABLE public.registrations 
ADD COLUMN hostel_name text;

-- Create an index for faster filtering by hostel
CREATE INDEX idx_registrations_hostel_name ON public.registrations(hostel_name);