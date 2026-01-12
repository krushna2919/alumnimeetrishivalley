-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view their own registration by email" ON public.registrations;

-- Create a proper SELECT policy that verifies email ownership via JWT
CREATE POLICY "Users can view their own registration by email"
ON public.registrations FOR SELECT
TO anon, authenticated
USING (
  email = (auth.jwt() ->> 'email')
);

-- Drop the insecure UPDATE policy
DROP POLICY IF EXISTS "Allow update own registration payment by application_id" ON public.registrations;

-- Create a proper UPDATE policy that verifies ownership AND restricts what can be updated
CREATE POLICY "Allow update own registration payment by application_id"
ON public.registrations FOR UPDATE
TO anon, authenticated
USING (
  application_id IS NOT NULL AND
  email = (auth.jwt() ->> 'email')
)
WITH CHECK (
  payment_status IN ('pending', 'submitted') AND
  registration_status = 'pending'
);