import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import ScheduledPeriodsManager from '@/components/admin/ScheduledPeriodsManager';
import InviteManager from '@/components/admin/InviteManager';
import { useAuth } from '@/hooks/useAuth';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Moon, Sun } from 'lucide-react';

const AdminSettings = () => {
  const { userRole } = useAuth();
  const isSuperadmin = userRole === 'superadmin';
  const isAdminOrSuperadmin = userRole === 'superadmin' || userRole === 'admin';

  // Local mirror of the admin theme preference. AdminLayout owns the actual
  // <html> class toggle; we notify it via a custom event so both stay in sync.
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('admin-theme') === 'dark';
  });

  useEffect(() => {
    const sync = () => setIsDarkMode(localStorage.getItem('admin-theme') === 'dark');
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const handleToggle = (checked: boolean) => {
    setIsDarkMode(checked);
    localStorage.setItem('admin-theme', checked ? 'dark' : 'light');
    window.dispatchEvent(new CustomEvent('admin-theme-change', { detail: { dark: checked } }));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage appearance, registration periods and batch configuration
          </p>
        </div>

        <div className="max-w-3xl space-y-8">
          {/* Appearance / theme preference */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-serif text-xl font-semibold text-foreground mb-1">Appearance</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Switch between light and dark mode for the admin module. This preference is saved on this browser.
            </p>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {isDarkMode ? (
                  <Moon className="h-5 w-5 text-foreground" />
                ) : (
                  <Sun className="h-5 w-5 text-foreground" />
                )}
                <Label htmlFor="admin-dark-mode" className="text-foreground">
                  Dark mode
                </Label>
              </div>
              <Switch
                id="admin-dark-mode"
                checked={isDarkMode}
                onCheckedChange={handleToggle}
                aria-label="Toggle dark mode"
              />
            </div>
          </section>

          <ScheduledPeriodsManager />

          {isAdminOrSuperadmin && (
            <>
              <div className="border-t border-border pt-8">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-4">Private Registration Invites</h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Send private invite links to individuals who need to register after the registration window has closed. Each link is single-use and expires in 24 hours.
                </p>
                <InviteManager />
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
