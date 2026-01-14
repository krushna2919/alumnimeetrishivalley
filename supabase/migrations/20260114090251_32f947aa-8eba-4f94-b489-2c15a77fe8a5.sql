-- Allow superadmins to delete registrations
CREATE POLICY "Superadmin can delete registrations"
ON public.registrations
FOR DELETE
USING (has_role(auth.uid(), 'superadmin'::app_role));