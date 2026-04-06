import AdminLayout from '@/components/admin/AdminLayout';
import ScheduledPeriodsManager from '@/components/admin/ScheduledPeriodsManager';
import InviteManager from '@/components/admin/InviteManager';
import { useAuth } from '@/hooks/useAuth';

const AdminSettings = () => {
  const { role } = useAuth();
  const isSuperadmin = role === 'superadmin';

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage registration periods and batch configuration
          </p>
        </div>

        <div className="max-w-3xl space-y-8">
          <ScheduledPeriodsManager />

          {isSuperadmin && (
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
