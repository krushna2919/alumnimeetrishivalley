ALTER TABLE public.registration_invites
ALTER COLUMN expires_at SET DEFAULT (now() + interval '48 hours');