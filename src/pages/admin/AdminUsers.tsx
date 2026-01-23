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
import { Loader2, UserPlus, Trash2, ShieldAlert, CheckCircle, XCircle, X } from 'lucide-react';
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

interface GroupedUser {
  user_id: string;
  email: string;
  roles: UserRole[];
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
  const [pendingRoleAssignment, setPendingRoleAssignment] = useState<{
    userId: string;
    email: string;
    role: AppRole;
  } | null>(null);
  const [isAssigningRole, setIsAssigningRole] = useState(false);

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

  // Handle adding a role to an existing user (no email sent)
  const handleAddRoleToExistingUser = async () => {
    if (!pendingRoleAssignment) return;

    setIsAssigningRole(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication required');
        return;
      }

      // Call edge function with sendInviteEmail: false for existing users with roles
      const response = await supabase.functions.invoke('invite-admin-user', {
        body: {
          email: pendingRoleAssignment.email,
          role: pendingRoleAssignment.role,
          siteUrl: window.location.origin,
          sendInviteEmail: false, // Don't send email for existing role holders
        },
      });

      if (response.error) {
        toast.error('Failed to assign role', {
          description: response.error.message || 'Edge function invocation failed',
        });
        return;
      }

      const data = response.data as any;

      if (data?.error) {
        toast.error('Failed to assign role', {
          description: String(data.error),
        });
        return;
      }

      toast.success(`Role assigned successfully`, {
        description: `${pendingRoleAssignment.email} is now also ${pendingRoleAssignment.role === 'admin' ? 'an admin' : `a ${pendingRoleAssignment.role}`}.`,
      });

      await fetchUserRoles();
    } catch (err: any) {
      console.error('Error assigning role', err);
      toast.error('Failed to assign role', {
        description: err?.message || 'Unknown error',
      });
    } finally {
      setIsAssigningRole(false);
      setPendingRoleAssignment(null);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'destructive';
      case 'admin':
        return 'default';
      case 'accounts_admin':
        return 'default';
      case 'reviewer':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Group users by email for the approved admins view
  const groupedUsers: GroupedUser[] = userRoles
    .filter(r => r.is_approved)
    .reduce((acc, role) => {
      const existing = acc.find(u => u.user_id === role.user_id);
      if (existing) {
        existing.roles.push(role);
      } else {
        acc.push({
          user_id: role.user_id,
          email: role.email || role.user_id,
          roles: [role]
        });
      }
      return acc;
    }, [] as GroupedUser[]);

  // Get available roles that can be added to a user
  const getAvailableRoles = (userId: string): AppRole[] => {
    const existingRoles = userRoles
      .filter(r => r.user_id === userId && r.is_approved)
      .map(r => r.role);
    const allAvailableRoles: AppRole[] = ['reviewer', 'accounts_admin', 'admin', 'superadmin'];
    return allAvailableRoles.filter(r => !existingRoles.includes(r));
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
            Manage admin roles and permissions. Users can have multiple roles.
          </p>
        </div>

        {/* Add New User/Role Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add User or Role
            </CardTitle>
            <CardDescription>
              Add a new user or assign an additional role to an existing user.
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
                <Label htmlFor="role">Role to Add</Label>
                <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="accounts_admin">Accounts Admin</SelectItem>
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
                      Add Role
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

        {/* Approved Admins Table - Grouped by User */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Approved Users
            </CardTitle>
            <CardDescription>
              Users with active roles. Each user can have multiple roles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {groupedUsers.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No approved users found.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedUsers.map((groupedUser) => (
                    <TableRow key={groupedUser.user_id}>
                      <TableCell className="font-medium">{groupedUser.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {groupedUser.roles.map((role) => (
                            <div key={role.id} className="flex items-center gap-1">
                              <Badge variant={getRoleBadgeVariant(role.role)}>
                                {role.role}
                              </Badge>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                    disabled={deletingId === role.id}
                                  >
                                    {deletingId === role.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <X className="h-3 w-3" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Role</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Remove the <strong>{role.role}</strong> role from {groupedUser.email}? 
                                      {groupedUser.roles.length === 1 && ' This is their only role - they will lose all admin access.'}
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
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getAvailableRoles(groupedUser.user_id).length > 0 && (
                            <>
                              {pendingRoleAssignment?.userId === groupedUser.user_id ? (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-muted">
                                    {pendingRoleAssignment.role}
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-7"
                                    onClick={handleAddRoleToExistingUser}
                                    disabled={isAssigningRole}
                                  >
                                    {isAssigningRole ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                    )}
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7"
                                    onClick={() => setPendingRoleAssignment(null)}
                                    disabled={isAssigningRole}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Select
                                  onValueChange={(role) => {
                                    setPendingRoleAssignment({
                                      userId: groupedUser.user_id,
                                      email: groupedUser.email,
                                      role: role as AppRole,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-8 w-[140px]">
                                    <SelectValue placeholder="Add role..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getAvailableRoles(groupedUser.user_id).map((role) => (
                                      <SelectItem key={role} value={role}>
                                        {role}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </>
                          )}
                        </div>
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
