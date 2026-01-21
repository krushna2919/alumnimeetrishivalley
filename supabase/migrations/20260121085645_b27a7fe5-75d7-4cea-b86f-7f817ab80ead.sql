-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Allow update own registration payment by application_id" ON public.registrations;

-- Create a new policy that allows unauthenticated updates for payment proof
-- This allows updating payment_proof_url and payment_status for recent pending registrations
CREATE POLICY "Allow update own registration payment" ON public.registrations
FOR UPDATE
USING (
  -- Allow update for registrations created in the last 24 hours
  created_at > (now() - interval '24 hours')
  AND payment_status = 'pending'::payment_status
  AND registration_status = 'pending'::registration_status
)
WITH CHECK (
  -- Only allow setting these specific statuses
  payment_status IN ('pending'::payment_status, 'submitted'::payment_status)
  AND registration_status = 'pending'::registration_status
);