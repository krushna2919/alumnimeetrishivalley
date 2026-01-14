-- Add payment_proof_url column to registrations table
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to payment proofs
CREATE POLICY "Payment proofs are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'payment-proofs');

-- Allow authenticated users to upload payment proofs
CREATE POLICY "Users can upload payment proofs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'payment-proofs');

-- Allow users to update their own payment proofs
CREATE POLICY "Users can update payment proofs"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'payment-proofs');

-- Allow admins to delete payment proofs
CREATE POLICY "Admins can delete payment proofs"
ON storage.objects
FOR DELETE
USING (bucket_id = 'payment-proofs');