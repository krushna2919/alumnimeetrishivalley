-- Create a function to check if user is admin, superadmin, or reviewer
CREATE OR REPLACE FUNCTION public.is_registration_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'superadmin', 'reviewer')
      AND is_approved = true
  )
$$;

-- Update registrations policies to include reviewer role
DROP POLICY IF EXISTS "Admins can view all registrations" ON public.registrations;
DROP POLICY IF EXISTS "Admins can update registrations" ON public.registrations;

CREATE POLICY "Registration managers can view all registrations"
  ON public.registrations
  FOR SELECT
  USING (is_registration_manager(auth.uid()));

CREATE POLICY "Registration managers can update registrations"
  ON public.registrations
  FOR UPDATE
  USING (is_registration_manager(auth.uid()));