import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Users, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface DashboardStats {
  totalRegistrations: number;
  pendingRegistrations: number;
  approvedRegistrations: number;
  rejectedRegistrations: number;
  pendingPayments: number;
  verifiedPayments: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: registrations, error } = await supabase
        .from('registrations')
        .select('registration_status, payment_status');

      if (error) throw error;

      const stats: DashboardStats = {
        totalRegistrations: registrations?.length || 0,
        pendingRegistrations: registrations?.filter(r => r.registration_status === 'pending').length || 0,
        approvedRegistrations: registrations?.filter(r => r.registration_status === 'approved').length || 0,
        rejectedRegistrations: registrations?.filter(r => r.registration_status === 'rejected').length || 0,
        pendingPayments: registrations?.filter(r => r.payment_status === 'pending' || r.payment_status === 'submitted').length || 0,
        verifiedPayments: registrations?.filter(r => r.payment_status === 'verified').length || 0,
      };

      setStats(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Registrations',
      value: stats?.totalRegistrations || 0,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Pending Review',
      value: stats?.pendingRegistrations || 0,
      icon: Clock,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      title: 'Approved',
      value: stats?.approvedRegistrations || 0,
      icon: CheckCircle,
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
    },
    {
      title: 'Rejected',
      value: stats?.rejectedRegistrations || 0,
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of alumni meet registrations
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {statCards.map((stat) => (
                <Card key={stat.title} className="shadow-card">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-full ${stat.bgColor}`}>
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold font-serif">{stat.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="font-serif">Payment Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Pending/Submitted</span>
                      <span className="font-semibold">{stats?.pendingPayments || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Verified</span>
                      <span className="font-semibold text-secondary">{stats?.verifiedPayments || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="font-serif">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <a 
                      href="/admin/registrations" 
                      className="block p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                    >
                      <span className="font-medium">Review Registrations</span>
                      <p className="text-sm text-muted-foreground">
                        {stats?.pendingRegistrations || 0} awaiting review
                      </p>
                    </a>
                    <a 
                      href="/admin/settings" 
                      className="block p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                    >
                      <span className="font-medium">Batch Settings</span>
                      <p className="text-sm text-muted-foreground">
                        Manage registration periods
                      </p>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
