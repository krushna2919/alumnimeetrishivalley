-- Allow registration managers (admin/superadmin/reviewer/accounts_admin) to list/view receipt objects
-- Needed for supabase.storage.from('payment-receipts').list() in the admin UI

CREATE POLICY "Registration managers can list payment receipts"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'payment-receipts'
  AND public.is_registration_manager(auth.uid())
);
