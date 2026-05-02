-- Add invite tracking columns to registrations
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS via_invite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invite_token text;

CREATE INDEX IF NOT EXISTS idx_registrations_via_invite ON public.registrations(via_invite) WHERE via_invite = true;

-- Backfill: mark existing registrations as invite-based when their email matches a used invite
UPDATE public.registrations r
SET via_invite = true,
    invite_token = i.token
FROM public.registration_invites i
WHERE i.used = true
  AND lower(i.email) = lower(r.email)
  AND r.via_invite = false;

-- Also propagate to group members (children) of any primary registration that came via invite
UPDATE public.registrations child
SET via_invite = true,
    invite_token = parent.invite_token
FROM public.registrations parent
WHERE child.parent_application_id = parent.application_id
  AND parent.via_invite = true
  AND child.via_invite = false;