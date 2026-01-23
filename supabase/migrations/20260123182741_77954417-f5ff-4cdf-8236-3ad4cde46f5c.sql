-- Create geofence_settings table for storing base location
CREATE TABLE public.geofence_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  radius_km DECIMAL(5, 2) NOT NULL DEFAULT 2.5,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.geofence_settings ENABLE ROW LEVEL SECURITY;

-- Superadmin can view geofence settings
CREATE POLICY "Superadmin can view geofence settings"
ON public.geofence_settings
FOR SELECT
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- Superadmin can insert geofence settings
CREATE POLICY "Superadmin can insert geofence settings"
ON public.geofence_settings
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- Superadmin can update geofence settings
CREATE POLICY "Superadmin can update geofence settings"
ON public.geofence_settings
FOR UPDATE
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- Superadmin can delete geofence settings
CREATE POLICY "Superadmin can delete geofence settings"
ON public.geofence_settings
FOR DELETE
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- Add location columns to user_device_sessions
ALTER TABLE public.user_device_sessions
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS location_city TEXT,
ADD COLUMN IF NOT EXISTS location_region TEXT,
ADD COLUMN IF NOT EXISTS location_country TEXT;

-- Create trigger for updated_at on geofence_settings
CREATE TRIGGER update_geofence_settings_updated_at
BEFORE UPDATE ON public.geofence_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check if user is superadmin (for public access during login)
CREATE OR REPLACE FUNCTION public.is_user_superadmin(_user_id uuid)
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
      AND role = 'superadmin'::app_role
      AND is_approved = true
  )
$$;

-- Create function to get geofence settings (public access for login check)
CREATE OR REPLACE FUNCTION public.get_geofence_settings()
RETURNS TABLE(latitude DECIMAL, longitude DECIMAL, radius_km DECIMAL, is_enabled BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT latitude, longitude, radius_km, is_enabled
  FROM public.geofence_settings
  LIMIT 1;
$$;