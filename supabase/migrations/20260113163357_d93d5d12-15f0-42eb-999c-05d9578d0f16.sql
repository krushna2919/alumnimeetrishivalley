-- Add is_approved column to user_roles
ALTER TABLE public.user_roles 
ADD COLUMN is_approved boolean NOT NULL DEFAULT false;

-- Set existing roles as approved
UPDATE public.user_roles SET is_approved = true;

-- Allow authenticated users to request admin role (insert their own pending role)
CREATE POLICY "Users can request admin role"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND role = 'admin'::app_role 
    AND is_approved = false
  );

-- Allow users to view their own pending status
-- (already exists: "Users can view their own roles")

-- Update batch_configuration policies to allow admins
DROP POLICY IF EXISTS "Superadmin can delete batch configurations" ON public.batch_configuration;
DROP POLICY IF EXISTS "Superadmin can insert batch configurations" ON public.batch_configuration;
DROP POLICY IF EXISTS "Superadmin can update batch configurations" ON public.batch_configuration;
DROP POLICY IF EXISTS "Superadmin can view all batch configurations" ON public.batch_configuration;

CREATE POLICY "Admins can view batch configurations"
  ON public.batch_configuration
  FOR SELECT
  USING (is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can insert batch configurations"
  ON public.batch_configuration
  FOR INSERT
  WITH CHECK (is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can update batch configurations"
  ON public.batch_configuration
  FOR UPDATE
  USING (is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can delete batch configurations"
  ON public.batch_configuration
  FOR DELETE
  USING (is_admin_or_superadmin(auth.uid()));