-- Create a new storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', true);

-- Create RLS policies for the payment-receipts bucket
CREATE POLICY "Anyone can view payment receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-receipts');

CREATE POLICY "Registration managers can upload receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payment-receipts' AND is_registration_manager(auth.uid()));

CREATE POLICY "Registration managers can update receipts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'payment-receipts' AND is_registration_manager(auth.uid()));

CREATE POLICY "Admins can delete receipts"
ON storage.objects FOR DELETE
USING (bucket_id = 'payment-receipts' AND is_admin_or_superadmin(auth.uid()));