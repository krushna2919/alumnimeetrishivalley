import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Loader2, Activity, Smartphone, Monitor, Tablet, Search, Filter, Shield, User } from 'lucide-react';
import { format } from 'date-fns';
import { Json } from '@/integrations/supabase/types';

interface ActivityLog {
  id: string;
  admin_user_id: string;
  admin_email: string | null;
  action_type: string;
  target_registration_id: string | null;
  target_application_id: string | null;
  details: Json;
  created_at: string;
}

interface DeviceSession {
  id: string;
  user_id: string;
  user_email: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  user_agent: string | null;
  last_active_at: string;
  created_at: string;
}

interface GroupedDeviceSessions {
  user_id: string;
  user_email: string;
  sessions: DeviceSession[];
  device_count: number;
}

const AdminActivityDashboard = () => {
  const { userRole, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const isSuperadmin = userRole === 'superadmin';

  useEffect(() => {
    if (!authLoading && !isSuperadmin) {
      navigate('/admin');
    }
  }, [authLoading, isSuperadmin, navigate]);

  useEffect(() => {
    if (isSuperadmin) {
      fetchData();
    }
  }, [isSuperadmin]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [logsResult, sessionsResult] = await Promise.all([
        supabase
          .from('admin_activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('user_device_sessions')
          .select('*')
          .order('last_active_at', { ascending: false })
      ]);

      if (logsResult.error) throw logsResult.error;
      if (sessionsResult.error) throw sessionsResult.error;

      setActivityLogs((logsResult.data || []) as ActivityLog[]);
      setDeviceSessions((sessionsResult.data || []) as DeviceSession[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionBadge = (actionType: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      account_approval: { label: 'Account Approved', variant: 'default' },
      account_rejection: { label: 'Account Rejected', variant: 'destructive' },
      receipt_upload: { label: 'Receipt Uploaded', variant: 'secondary' },
      registration_approval: { label: 'Registration Approved', variant: 'default' },
      registration_rejection: { label: 'Registration Rejected', variant: 'destructive' },
      bed_assignment: { label: 'Bed Assigned', variant: 'secondary' },
      bed_unassignment: { label: 'Bed Unassigned', variant: 'outline' }
    };
    
    const actionConfig = config[actionType] || { label: actionType, variant: 'outline' as const };
    return <Badge variant={actionConfig.variant}>{actionConfig.label}</Badge>;
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const filteredLogs = activityLogs.filter(log => {
    const matchesSearch = 
      log.admin_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.target_application_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.action_type === actionFilter;
    return matchesSearch && matchesAction;
  });

  const groupedSessions: GroupedDeviceSessions[] = deviceSessions.reduce((acc, session) => {
    const existing = acc.find(g => g.user_id === session.user_id);
    if (existing) {
      existing.sessions.push(session);
      existing.device_count = existing.sessions.length;
    } else {
      acc.push({
        user_id: session.user_id,
        user_email: session.user_email || 'Unknown',
        sessions: [session],
        device_count: 1
      });
    }
    return acc;
  }, [] as GroupedDeviceSessions[]);

  if (authLoading || isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!isSuperadmin) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Admin Activity Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Track admin actions and user device sessions
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Actions</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-serif">{activityLogs.length}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
              <User className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-serif">{groupedSessions.length}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Devices</CardTitle>
              <Monitor className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-serif">{deviceSessions.length}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approvals Today</CardTitle>
              <Shield className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-serif">
                {activityLogs.filter(l => 
                  (l.action_type === 'account_approval' || l.action_type === 'registration_approval') &&
                  new Date(l.created_at).toDateString() === new Date().toDateString()
                ).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="activity" className="space-y-4">
          <TabsList>
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="h-4 w-4" />
              Activity Logs
            </TabsTrigger>
            <TabsTrigger value="devices" className="gap-2">
              <Monitor className="h-4 w-4" />
              Device Sessions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Admin Activity Logs</CardTitle>
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email or application ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="account_approval">Account Approval</SelectItem>
                        <SelectItem value="account_rejection">Account Rejection</SelectItem>
                        <SelectItem value="receipt_upload">Receipt Upload</SelectItem>
                        <SelectItem value="registration_approval">Registration Approval</SelectItem>
                        <SelectItem value="registration_rejection">Registration Rejection</SelectItem>
                        <SelectItem value="bed_assignment">Bed Assignment</SelectItem>
                        <SelectItem value="bed_unassignment">Bed Unassignment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Admin</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Application ID</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Timestamp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No activity logs found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">
                              {log.admin_email || 'Unknown'}
                            </TableCell>
                            <TableCell>{getActionBadge(log.action_type)}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {log.target_application_id || '-'}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0 
                                ? JSON.stringify(log.details)
                                : '-'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm')}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="devices" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">User Device Sessions</CardTitle>
                <p className="text-sm text-muted-foreground">
                  View all devices and sessions for each admin user
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {groupedSessions.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      No device sessions recorded yet
                    </p>
                  ) : (
                    groupedSessions.map((group) => (
                      <Card key={group.user_id} className="border-l-4 border-l-primary">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <User className="h-5 w-5 text-primary" />
                              <div>
                                <p className="font-medium">{group.user_email}</p>
                                <p className="text-sm text-muted-foreground">
                                  User ID: {group.user_id.substring(0, 8)}...
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="gap-1">
                              <Monitor className="h-3 w-3" />
                              {group.device_count} device{group.device_count !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Device</TableHead>
                                  <TableHead>Browser</TableHead>
                                  <TableHead>OS</TableHead>
                                  <TableHead>Last Active</TableHead>
                                  <TableHead>First Seen</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.sessions.map((session) => (
                                  <TableRow key={session.id}>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        {getDeviceIcon(session.device_type)}
                                        <span className="capitalize">{session.device_type || 'Desktop'}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell>{session.browser || 'Unknown'}</TableCell>
                                    <TableCell>{session.os || 'Unknown'}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {format(new Date(session.last_active_at), 'dd MMM yyyy, HH:mm')}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {format(new Date(session.created_at), 'dd MMM yyyy, HH:mm')}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminActivityDashboard;
