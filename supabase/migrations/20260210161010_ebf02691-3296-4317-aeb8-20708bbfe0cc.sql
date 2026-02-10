ALTER TABLE public.batch_configuration 
  ADD COLUMN IF NOT EXISTS start_minute integer NOT NULL DEFAULT 0;

ALTER TABLE public.batch_configuration 
  ADD CONSTRAINT valid_start_minute CHECK (start_minute >= 0 AND start_minute <= 59);