-- Add unique constraint on user_id + session_id to prevent duplicates at database level
ALTER TABLE public.user_device_sessions 
ADD CONSTRAINT unique_user_session UNIQUE (user_id, session_id);