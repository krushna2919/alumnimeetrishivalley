import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, UserPlus, Trash2, ShieldAlert, CheckCircle, XCircle } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  email?: string;
  is_approved: boolean;
}

const AdminUsers = () => {
  const { user } = useAuth();
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('admin');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    checkSuperadminAndFetchRoles();
  }, [user]);

  const checkSuperadminAndFetchRoles = async () => {
    if (!user) return;

    try {
      // Check if current user is superadmin
      const { data: isSuperadminData, error: roleError } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'superadmin'
      });

      if (roleError) throw roleError;
      setIsSuperadmin(isSuperadminData === true);

      if (isSuperadminData) {
        await fetchUserRoles();
      }
    } catch (err) {
      console.error('Error checking superadmin status');
      toast.error('Failed to verify permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserRoles = async () => {
    try {
      // Fetch user roles with profile info
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('is_approved', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch emails from profiles
      const userIds = roles?.map(r => r.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      const rolesWithEmail = roles?.map(role => ({
        ...role,
        email: profiles?.find(p => p.id === role.user_id)?.email || role.user_id
      })) || [];

      setUserRoles(rolesWithEmail);
    } catch (err) {
      console.error('Error fetching user roles');
      toast.error('Failed to load user roles');
    }
  };

  const handleApproveRole = async (roleId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ is_approved: true })
        .eq('id', roleId);

      if (error) throw error;

      toast.success('Admin access approved');
      await fetchUserRoles();
    } catch (err) {
      console.error('Error approving role');
      toast.error('Failed to approve admin access');
    }
  };

  const handleRejectRole = async (roleId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      toast.success('Admin request rejected');
      await fetchUserRoles();
    } catch (err) {
      console.error('Error rejecting role');
      toast.error('Failed to reject admin request');
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail.trim())) {
      toast.error('Invalid email format');
      return;
    }

    setIsAdding(true);
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication required');
        return;
      }

      // Call edge function to invite/add user
      const response = await supabase.functions.invoke('invite-admin-user', {
        body: {
          email: newUserEmail.trim(),
          role: newUserRole,
          siteUrl: window.location.origin,
          sendInviteEmail: true,
        },
      });

      console.log('[AdminUsers] invite-admin-user response:', response);

      if (response.error) {
        toast.error('Failed to add user', {
          description: response.error.message || 'Edge function invocation failed',
        });
        return;
      }

      const data = response.data as any;

      if (data?.error) {
        toast.error('Failed to add user', {
          description: String(data.error),
        });
        return;
      }

      const emailStatus = data?.emailStatus as { attempted?: boolean; sent?: boolean; error?: string | null } | undefined;
      const actionLink = data?.actionLink as string | null | undefined;

      if (emailStatus?.attempted && !emailStatus?.sent) {
        toast.error('Invite email failed to send', {
          description: emailStatus?.error || 'Unknown email error',
        });
      }

      toast.success(data?.isNewUser ? 'User created successfully' : 'Role assigned successfully', {
        description: actionLink
          ? `Password link generated. If email didn't arrive, copy this link: ${actionLink}`
          : (data?.isNewUser
              ? `Password setup email attempted for ${newUserEmail}.`
              : `${newUserEmail} is now ${newUserRole === 'admin' ? 'an admin' : 'a superadmin'}.`),
      });

      setNewUserEmail('');
      await fetchUserRoles();
    } catch (err: any) {
      console.error('Error adding user role', err);
      toast.error('Failed to add user', {
        description: err?.message || 'Unknown error',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    setDeletingId(roleId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      toast.success('Role removed successfully');
      await fetchUserRoles();
    } catch (err) {
      console.error('Error deleting role');
      toast.error('Failed to remove role');
    } finally {
      setDeletingId(null);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'destructive';
      case 'admin':
        return 'default';
      case 'reviewer':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!isSuperadmin) {
    return (
      <AdminLayout>
        <Card className="max-w-md mx-auto mt-8">
          <CardHeader className="text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-destructive mb-2" />
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only superadmins can manage user roles.
            </CardDescription>
          </CardHeader>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage admin and superadmin access
          </p>
        </div>

        {/* Add New User Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Admin User
            </CardTitle>
            <CardDescription>
              Add a new admin or superadmin. If the user doesn't exist, a new account will be created.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="email">User Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-40 space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="superadmin">Superadmin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddUser} disabled={isAdding}>
                  {isAdding ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add User
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        {userRoles.filter(r => !r.is_approved).length > 0 && (
          <Card className="border-amber-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <XCircle className="h-5 w-5" />
                Pending Approvals
              </CardTitle>
              <CardDescription>
                Users waiting for admin access approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role Requested</TableHead>
                    <TableHead>Requested On</TableHead>
                    <TableHead className="w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRoles.filter(r => !r.is_approved).map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {role.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(role.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleApproveRole(role.id)}
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reject Request</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to reject the admin request from {role.email}? 
                                  This will remove their pending request.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRejectRole(role.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Reject
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Approved Admins Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Approved Admins
            </CardTitle>
            <CardDescription>
              Users with active admin or superadmin access
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userRoles.filter(r => r.is_approved).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No approved admin users found.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRoles.filter(r => r.is_approved).map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(role.role)}>
                          {role.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(role.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              disabled={deletingId === role.id}
                            >
                              {deletingId === role.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Role</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove the {role.role} role from {role.email}? 
                                They will lose access to admin features.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteRole(role.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
