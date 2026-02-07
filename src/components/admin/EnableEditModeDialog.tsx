import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Edit3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { logAdminActivity } from '@/lib/activityLogger';
import { Tables } from '@/integrations/supabase/types';

type Registration = Tables<'registrations'>;

interface EnableEditModeDialogProps {
  registration: Registration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const EnableEditModeDialog = ({
  registration,
  open,
  onOpenChange,
  onSuccess,
}: EnableEditModeDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [reason, setReason] = useState('');

  const handleEnableEditMode = async () => {
    if (!registration || !reason.trim()) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('registrations')
        .update({
          edit_mode_enabled: true,
          edit_mode_enabled_by: user?.id,
          edit_mode_enabled_at: new Date().toISOString(),
          edit_mode_reason: reason.trim(),
          // Reset registration status and accounts verification
          registration_status: 'pending',
          accounts_verified: false,
          accounts_verified_at: null,
          accounts_verified_by: null,
          // Clear only the receipt URL - keep existing payment proof for reference
          payment_receipt_url: null,
          // Set pending admin approval to false until accounts admin verifies
          pending_admin_approval: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', registration.id);

      if (error) throw error;

      // Log the activity
      await logAdminActivity({
        actionType: 'edit_mode_enabled',
        targetRegistrationId: registration.id,
        targetApplicationId: registration.application_id,
        details: { 
          reason,
          previousStatus: registration.registration_status,
        }
      });

      toast({
        title: 'Edit Mode Enabled',
        description: `Edit mode enabled for ${registration.application_id}. Accounts admin can now upload new payment proof.`,
      });

      setReason('');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error enabling edit mode:', error);
      toast({
        title: 'Error',
        description: 'Failed to enable edit mode',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!registration) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Enable Edit Mode
          </DialogTitle>
          <DialogDescription>
            This will allow accounts admin to upload a new payment proof and receipt for{' '}
            <span className="font-semibold">{registration.application_id}</span>.
            After accounts admin verifies, admin can approve to notify the applicant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-accent/30 border border-accent/50">
            <p className="text-sm text-accent-foreground">
              <strong>Note:</strong> Enabling edit mode will:
            </p>
            <ul className="text-sm text-accent-foreground mt-2 list-disc list-inside space-y-1">
              <li>Change registration status back to <strong>pending</strong></li>
              <li>Reset accounts verification status</li>
              <li>Keep existing payment proof for reference</li>
              <li>Require accounts admin to upload a <strong>new</strong> payment proof and receipt</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-reason">Reason for enabling edit mode *</Label>
            <Textarea
              id="edit-reason"
              placeholder="e.g., Changing stay type from Outside to On-Campus"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleEnableEditMode}
            disabled={isProcessing || !reason.trim()}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Edit3 className="h-4 w-4 mr-2" />
            )}
            Enable Edit Mode
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EnableEditModeDialog;
