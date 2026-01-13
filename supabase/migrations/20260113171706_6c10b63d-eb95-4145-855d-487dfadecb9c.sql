-- Update policy to allow users to request reviewer role as well
DROP POLICY IF EXISTS "Users can request admin role" ON public.user_roles;

CREATE POLICY "Users can request admin or reviewer role"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role::text IN ('admin', 'reviewer')
    AND is_approved = false
  );