
-- Create hostels table to store hostel configuration
CREATE TABLE public.hostels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  total_rooms integer NOT NULL DEFAULT 0,
  beds_per_room integer NOT NULL DEFAULT 1,
  washrooms integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create rooms table
CREATE TABLE public.hostel_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid REFERENCES public.hostels(id) ON DELETE CASCADE NOT NULL,
  room_number text NOT NULL,
  beds_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(hostel_id, room_number)
);

-- Create bed assignments table
CREATE TABLE public.bed_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.hostel_rooms(id) ON DELETE CASCADE NOT NULL,
  bed_number integer NOT NULL,
  registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(room_id, bed_number),
  UNIQUE(registration_id)
);

-- Enable RLS
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bed_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for hostels
CREATE POLICY "Registration managers can view hostels"
ON public.hostels FOR SELECT
USING (is_registration_manager(auth.uid()));

CREATE POLICY "Admins can insert hostels"
ON public.hostels FOR INSERT
WITH CHECK (is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can update hostels"
ON public.hostels FOR UPDATE
USING (is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can delete hostels"
ON public.hostels FOR DELETE
USING (is_admin_or_superadmin(auth.uid()));

-- RLS policies for hostel_rooms
CREATE POLICY "Registration managers can view rooms"
ON public.hostel_rooms FOR SELECT
USING (is_registration_manager(auth.uid()));

CREATE POLICY "Admins can insert rooms"
ON public.hostel_rooms FOR INSERT
WITH CHECK (is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can update rooms"
ON public.hostel_rooms FOR UPDATE
USING (is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can delete rooms"
ON public.hostel_rooms FOR DELETE
USING (is_admin_or_superadmin(auth.uid()));

-- RLS policies for bed_assignments
CREATE POLICY "Registration managers can view bed assignments"
ON public.bed_assignments FOR SELECT
USING (is_registration_manager(auth.uid()));

CREATE POLICY "Registration managers can insert bed assignments"
ON public.bed_assignments FOR INSERT
WITH CHECK (is_registration_manager(auth.uid()));

CREATE POLICY "Registration managers can update bed assignments"
ON public.bed_assignments FOR UPDATE
USING (is_registration_manager(auth.uid()));

CREATE POLICY "Registration managers can delete bed assignments"
ON public.bed_assignments FOR DELETE
USING (is_registration_manager(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_hostels_updated_at
BEFORE UPDATE ON public.hostels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bed_assignments_updated_at
BEFORE UPDATE ON public.bed_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
