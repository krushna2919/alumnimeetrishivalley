-- Add 'accounts_admin' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accounts_admin';

-- Add 'reviewer' role if not exists (for existing functionality)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'reviewer' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE public.app_role ADD VALUE 'reviewer';
  END IF;
END$$;

-- Add accounts_verified column to registrations table
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS accounts_verified boolean NOT NULL DEFAULT false;

-- Add accounts_verified_at and accounts_verified_by columns
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS accounts_verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS accounts_verified_by uuid;

-- Add expired status to registration_status enum if needed for re-enable workflow
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'expired' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'registration_status')) THEN
    ALTER TYPE public.registration_status ADD VALUE 'expired';
  END IF;
END$$;

-- Create function to check if user is accounts_admin
CREATE OR REPLACE FUNCTION public.is_accounts_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = 'accounts_admin'
      AND is_approved = true
  )
$$;

-- Update is_registration_manager to include accounts_admin
CREATE OR REPLACE FUNCTION public.is_registration_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'superadmin', 'reviewer', 'accounts_admin')
      AND is_approved = true
  )
$$;