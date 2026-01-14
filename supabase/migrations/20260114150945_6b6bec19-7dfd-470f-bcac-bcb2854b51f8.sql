-- Add parent_application_id column to link additional attendees to primary registrant
ALTER TABLE public.registrations 
ADD COLUMN parent_application_id text REFERENCES public.registrations(application_id);

-- Create index for faster lookups
CREATE INDEX idx_registrations_parent_application_id ON public.registrations(parent_application_id);

-- Add comment for clarity
COMMENT ON COLUMN public.registrations.parent_application_id IS 'For additional attendees, this references the primary registrant application ID';