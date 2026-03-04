
-- Create registration_invites table
CREATE TABLE public.registration_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  extended_count integer NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.registration_invites ENABLE ROW LEVEL SECURITY;

-- Admins can manage invites
CREATE POLICY "Admins can view all invites"
  ON public.registration_invites FOR SELECT
  TO authenticated
  USING (is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can insert invites"
  ON public.registration_invites FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can update invites"
  ON public.registration_invites FOR UPDATE
  TO authenticated
  USING (is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can delete invites"
  ON public.registration_invites FOR DELETE
  TO authenticated
  USING (is_admin_or_superadmin(auth.uid()));

-- Public can read their own invite by token (for validation)
CREATE POLICY "Anyone can validate invite by token"
  ON public.registration_invites FOR SELECT
  TO anon
  USING (true);
