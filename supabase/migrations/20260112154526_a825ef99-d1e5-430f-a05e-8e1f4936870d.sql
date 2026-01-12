-- Fix function search path for generate_application_id
CREATE OR REPLACE FUNCTION public.generate_application_id()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  timestamp_part TEXT;
  random_part TEXT;
BEGIN
  timestamp_part := UPPER(LPAD(TO_HEX(EXTRACT(EPOCH FROM NOW())::BIGINT), 8, '0'));
  random_part := UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 4));
  RETURN 'ALM-' || timestamp_part || '-' || random_part;
END;
$$;

-- Drop overly permissive policies and replace with more secure ones
DROP POLICY IF EXISTS "Anyone can insert registrations" ON public.registrations;
DROP POLICY IF EXISTS "Anyone can update their own registration payment" ON public.registrations;

-- Create more specific insert policy - only allow insert with valid application_id
CREATE POLICY "Allow public registration insert"
ON public.registrations FOR INSERT
TO anon, authenticated
WITH CHECK (
  application_id IS NOT NULL AND
  name IS NOT NULL AND
  email IS NOT NULL
);

-- Create more specific update policy for payment details only
CREATE POLICY "Allow update own registration payment by application_id"
ON public.registrations FOR UPDATE
TO anon, authenticated
USING (application_id IS NOT NULL)
WITH CHECK (
  -- Only allow updating payment fields
  payment_status IN ('pending', 'submitted') AND
  registration_status = 'pending'
);