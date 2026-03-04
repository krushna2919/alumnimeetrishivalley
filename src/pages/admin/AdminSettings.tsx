import AdminLayout from '@/components/admin/AdminLayout';
import ScheduledPeriodsManager from '@/components/admin/ScheduledPeriodsManager';
import InviteManager from '@/components/admin/InviteManager';

const AdminSettings = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage registration periods, batch configuration, and invites
          </p>
        </div>

        <div className="max-w-3xl space-y-8">
          <ScheduledPeriodsManager />
          <InviteManager />
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
