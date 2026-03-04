
ALTER TABLE public.batch_configuration ADD COLUMN IF NOT EXISTS show_outside_option boolean NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS public.get_open_batch_configuration();

CREATE FUNCTION public.get_open_batch_configuration()
 RETURNS TABLE(registration_start_date timestamp with time zone, registration_end_date timestamp with time zone, year_from integer, year_to integer, is_registration_open boolean, show_stay_option boolean, show_outside_option boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    registration_start_date,
    registration_end_date,
    year_from,
    year_to,
    is_registration_open,
    show_stay_option,
    show_outside_option
  FROM public.batch_configuration
  WHERE is_registration_open = true
    AND (
      (registration_start_date IS NOT NULL AND registration_end_date IS NOT NULL
       AND now() >= registration_start_date
       AND now() <= (registration_end_date + interval '18 hours 30 minutes' + interval '1 day'))
      OR
      (registration_start_date IS NULL AND registration_end_date IS NULL)
    )
  ORDER BY registration_start_date ASC NULLS LAST
  LIMIT 1;
$function$;
