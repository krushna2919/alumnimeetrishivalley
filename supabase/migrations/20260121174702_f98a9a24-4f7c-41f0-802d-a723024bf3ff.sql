-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Allow update own registration payment" ON public.registrations;

-- Recreate as PERMISSIVE policy (default) so anonymous users can update within 24h window
CREATE POLICY "Allow update own registration payment" 
ON public.registrations 
FOR UPDATE 
USING (
  (created_at > (now() - interval '24 hours')) 
  AND (payment_status = 'pending'::payment_status) 
  AND (registration_status = 'pending'::registration_status)
)
WITH CHECK (
  (payment_status IN ('pending'::payment_status, 'submitted'::payment_status)) 
  AND (registration_status = 'pending'::registration_status)
);