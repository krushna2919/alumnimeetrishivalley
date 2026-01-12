-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Anyone can view open batch configurations" ON public.batch_configuration;

-- Create a SECURITY DEFINER function that returns only public-safe fields
CREATE OR REPLACE FUNCTION public.get_open_batch_configuration()
RETURNS TABLE (
  registration_start_date timestamptz,
  registration_end_date timestamptz,
  year_from integer,
  year_to integer,
  is_registration_open boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    registration_start_date,
    registration_end_date,
    year_from,
    year_to,
    is_registration_open
  FROM public.batch_configuration
  WHERE is_registration_open = true
  LIMIT 1;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_open_batch_configuration() TO anon, authenticated;