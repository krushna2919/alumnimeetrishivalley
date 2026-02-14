
-- Table to store email OTPs for registration verification
CREATE TABLE public.email_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (edge function uses service role, but we need the table accessible)
-- No SELECT/UPDATE/DELETE policies for anon - all access via service role in edge functions

-- Index for fast lookups
CREATE INDEX idx_email_otps_email_expires ON public.email_otps (email, expires_at DESC);

-- Auto-cleanup: delete expired OTPs older than 1 hour
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.email_otps WHERE expires_at < now() - interval '1 hour';
$$;
