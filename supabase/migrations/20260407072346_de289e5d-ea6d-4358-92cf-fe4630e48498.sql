ALTER TABLE public.registration_invites 
  ADD COLUMN year_from integer DEFAULT NULL,
  ADD COLUMN year_to integer DEFAULT NULL,
  ADD COLUMN force_outside_only boolean NOT NULL DEFAULT false;