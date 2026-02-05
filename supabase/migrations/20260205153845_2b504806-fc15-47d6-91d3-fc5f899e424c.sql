-- Add columns for edit mode workflow
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS edit_mode_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS edit_mode_enabled_by uuid,
ADD COLUMN IF NOT EXISTS edit_mode_enabled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS edit_mode_reason text,
ADD COLUMN IF NOT EXISTS pending_admin_approval boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS edit_changes_summary text;

-- Add comment for documentation
COMMENT ON COLUMN public.registrations.edit_mode_enabled IS 'When true, accounts admin can upload new payment proof';
COMMENT ON COLUMN public.registrations.pending_admin_approval IS 'When true, waiting for admin final approval after accounts admin verification';
COMMENT ON COLUMN public.registrations.edit_changes_summary IS 'Summary of changes made during edit mode for notification email';