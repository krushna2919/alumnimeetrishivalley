-- Admin activity logs table to track admin actions
CREATE TABLE public.admin_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  admin_email TEXT,
  action_type TEXT NOT NULL,
  target_registration_id UUID,
  target_application_id TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User device sessions table to track login devices
CREATE TABLE public.user_device_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT,
  device_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  browser TEXT,
  os TEXT,
  device_type TEXT,
  session_id TEXT,
  last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_admin_activity_logs_admin_user_id ON public.admin_activity_logs(admin_user_id);
CREATE INDEX idx_admin_activity_logs_action_type ON public.admin_activity_logs(action_type);
CREATE INDEX idx_admin_activity_logs_created_at ON public.admin_activity_logs(created_at DESC);
CREATE INDEX idx_user_device_sessions_user_id ON public.user_device_sessions(user_id);
CREATE INDEX idx_user_device_sessions_last_active ON public.user_device_sessions(last_active_at DESC);

-- Enable RLS
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_device_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin_activity_logs - only superadmin can view
CREATE POLICY "Superadmin can view all activity logs"
ON public.admin_activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'superadmin'));

-- Registration managers can insert activity logs
CREATE POLICY "Registration managers can insert activity logs"
ON public.admin_activity_logs
FOR INSERT
WITH CHECK (is_registration_manager(auth.uid()));

-- RLS policies for user_device_sessions
CREATE POLICY "Superadmin can view all device sessions"
ON public.user_device_sessions
FOR SELECT
USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Users can view their own sessions"
ON public.user_device_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert their sessions"
ON public.user_device_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their sessions"
ON public.user_device_sessions
FOR UPDATE
USING (auth.uid() = user_id);