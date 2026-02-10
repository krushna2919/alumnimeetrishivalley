
-- Add start_hour (IST, 0-23) and label columns to batch_configuration
ALTER TABLE public.batch_configuration 
  ADD COLUMN IF NOT EXISTS start_hour integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS label text;

-- Add constraint for valid hour range
ALTER TABLE public.batch_configuration 
  ADD CONSTRAINT valid_start_hour CHECK (start_hour >= 0 AND start_hour <= 23);

-- Update the get_open_batch_configuration function to return the currently active period
-- considering date/time boundaries. Returns the first matching open period ordered by start date.
CREATE OR REPLACE FUNCTION public.get_open_batch_configuration()
 RETURNS TABLE(registration_start_date timestamp with time zone, registration_end_date timestamp with time zone, year_from integer, year_to integer, is_registration_open boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    registration_start_date,
    registration_end_date,
    year_from,
    year_to,
    is_registration_open
  FROM public.batch_configuration
  WHERE is_registration_open = true
    AND (
      -- If dates are set, check if current time is within the period (with IST end-of-day buffer)
      (registration_start_date IS NOT NULL AND registration_end_date IS NOT NULL
       AND now() >= registration_start_date
       AND now() <= (registration_end_date + interval '18 hours 30 minutes' + interval '1 day'))
      OR
      -- If no dates set, just use the toggle
      (registration_start_date IS NULL AND registration_end_date IS NULL)
    )
  ORDER BY registration_start_date ASC NULLS LAST
  LIMIT 1;
$function$;
