-- Add payment_receipt_url column for accounts admin to upload receipts
ALTER TABLE public.registrations 
ADD COLUMN payment_receipt_url text;