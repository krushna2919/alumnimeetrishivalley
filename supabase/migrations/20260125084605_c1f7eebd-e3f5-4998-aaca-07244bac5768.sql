-- Create table for user screen permissions
CREATE TABLE public.user_screen_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  screen_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (user_id, screen_key)
);

-- Enable Row Level Security
ALTER TABLE public.user_screen_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Superadmin can view all screen permissions"
ON public.user_screen_permissions
FOR SELECT
USING (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Users can view their own screen permissions"
ON public.user_screen_permissions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Superadmin can insert screen permissions"
ON public.user_screen_permissions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Superadmin can update screen permissions"
ON public.user_screen_permissions
FOR UPDATE
USING (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Superadmin can delete screen permissions"
ON public.user_screen_permissions
FOR DELETE
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_user_screen_permissions_user_id ON public.user_screen_permissions(user_id);