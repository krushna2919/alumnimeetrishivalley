-- Add confirmation_email_sent_at timestamp column to track when approval email was successfully sent
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS approval_email_sent boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.registrations.approval_email_sent IS 'Flag indicating if approval/rejection email was successfully sent';