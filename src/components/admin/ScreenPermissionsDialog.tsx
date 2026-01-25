import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Monitor } from 'lucide-react';

// Define all available screens with their keys and labels
export const AVAILABLE_SCREENS = [
  { key: 'dashboard', label: 'Dashboard', path: '/admin' },
  { key: 'registrations', label: 'Registrations', path: '/admin/registrations' },
  { key: 'hostels', label: 'Hostel Management', path: '/admin/hostels' },
  { key: 'accounts_review', label: 'Payment Verification', path: '/admin/accounts-review' },
  { key: 'settings', label: 'Settings', path: '/admin/settings' },
] as const;

export type ScreenKey = typeof AVAILABLE_SCREENS[number]['key'];

interface ScreenPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  onSaved?: () => void;
}

const ScreenPermissionsDialog = ({
  open,
  onOpenChange,
  userId,
  userEmail,
  onSaved,
}: ScreenPermissionsDialogProps) => {
  const [selectedScreens, setSelectedScreens] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && userId) {
      fetchPermissions();
    }
  }, [open, userId]);

  const fetchPermissions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_screen_permissions')
        .select('screen_key')
        .eq('user_id', userId);

      if (error) throw error;

      const screens = new Set(data?.map((p) => p.screen_key) || []);
      setSelectedScreens(screens);
    } catch (err) {
      console.error('Error fetching screen permissions:', err);
      toast.error('Failed to load permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleScreen = (screenKey: string) => {
    setSelectedScreens((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(screenKey)) {
        newSet.delete(screenKey);
      } else {
        newSet.add(screenKey);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedScreens(new Set(AVAILABLE_SCREENS.map((s) => s.key)));
  };

  const handleClearAll = () => {
    setSelectedScreens(new Set());
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Delete all existing permissions for this user
      const { error: deleteError } = await supabase
        .from('user_screen_permissions')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Insert new permissions
      if (selectedScreens.size > 0) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        const permissionsToInsert = Array.from(selectedScreens).map((screenKey) => ({
          user_id: userId,
          screen_key: screenKey,
          created_by: currentUser?.id,
        }));

        const { error: insertError } = await supabase
          .from('user_screen_permissions')
          .insert(permissionsToInsert);

        if (insertError) throw insertError;
      }

      toast.success('Screen permissions updated');
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving screen permissions:', err);
      toast.error('Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Configure Screen Access
          </DialogTitle>
          <DialogDescription>
            Select which screens <strong>{userEmail}</strong> can access.
            {selectedScreens.size === 0 && (
              <span className="block mt-1 text-amber-600">
                No screens selected - user will see role-based defaults.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearAll}
              >
                Clear All
              </Button>
            </div>

            <div className="grid gap-3">
              {AVAILABLE_SCREENS.map((screen) => (
                <div
                  key={screen.key}
                  className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={screen.key}
                    checked={selectedScreens.has(screen.key)}
                    onCheckedChange={() => handleToggleScreen(screen.key)}
                  />
                  <Label
                    htmlFor={screen.key}
                    className="flex-1 cursor-pointer font-medium"
                  >
                    {screen.label}
                  </Label>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Permissions'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ScreenPermissionsDialog;
