
CREATE TABLE public.client_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  user_agent TEXT,
  page_url TEXT,
  error_type TEXT NOT NULL,
  message TEXT,
  stack TEXT,
  request_url TEXT,
  request_method TEXT,
  response_status INTEGER,
  console_logs JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert error logs (no auth required for error reporting)
CREATE POLICY "Anyone can insert error logs"
  ON public.client_error_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read error logs
CREATE POLICY "Admins can read error logs"
  ON public.client_error_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_superadmin(auth.uid()));

-- Index for recent logs lookup
CREATE INDEX idx_client_error_logs_created_at ON public.client_error_logs (created_at DESC);
