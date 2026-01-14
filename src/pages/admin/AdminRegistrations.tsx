import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { 
  Search, 
  Loader2, 
  Eye, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Mail,
  Trash2,
  Users,
  ChevronRight,
  CheckCheck,
  XOctagon,
  Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { Tables } from '@/integrations/supabase/types';

type Registration = Tables<'registrations'>;

const HOSTEL_OPTIONS = [
  'takshila', 'silver', 'golden', 'raavi', 'neem', 'palm', 'green', 'red',
  'amaltash', 'gulmohar', 'meru', 'nilgiri', 'krishna', 'cauvery', 'trishul',
  'jacaranda', 'duranta', 'malli'
] as const;

const AdminRegistrations = () => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showGrouped, setShowGrouped] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Registration[] | null>(null);
  const [isGroupRejectDialogOpen, setIsGroupRejectDialogOpen] = useState(false);
  const [groupRejectionReason, setGroupRejectionReason] = useState('');
  
  const { toast } = useToast();
  const { userRole } = useAuth();

  // Handle hostel assignment
  const handleHostelAssign = async (registration: Registration, hostelName: string) => {
    try {
      const { error } = await supabase
        .from('registrations')
        .update({ hostel_name: hostelName })
        .eq('id', registration.id);

      if (error) throw error;

      toast({
        title: 'Hostel Assigned',
        description: `${registration.name} has been assigned to ${hostelName.charAt(0).toUpperCase() + hostelName.slice(1)} hostel.`,
      });

      fetchRegistrations();
    } catch (error) {
      console.error('Error assigning hostel:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign hostel',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchRegistrations();

    // Subscribe to real-time changes on registrations table
    const channel = supabase
      .channel('registrations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'registrations'
        },
        (payload) => {
          console.log('Registration change detected:', payload.eventType);
          // Refresh the registrations list when any change occurs
          fetchRegistrations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    filterRegistrations();
  }, [registrations, searchQuery, statusFilter]);

  const fetchRegistrations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRegistrations(data || []);
    } catch (error) {
      console.error('Error fetching registrations:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch registrations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterRegistrations = () => {
    let filtered = [...registrations];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.email.toLowerCase().includes(query) ||
          r.application_id.toLowerCase().includes(query) ||
          r.phone.includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((r) => r.registration_status === statusFilter);
    }

    setFilteredRegistrations(filtered);
  };

  // Group registrations by parent_application_id
  const getGroupedRegistrations = () => {
    const groups: Map<string, Registration[]> = new Map();
    const standalone: Registration[] = [];

    // First pass: identify primary registrants (those without parent_application_id)
    filteredRegistrations.forEach(reg => {
      if (!reg.parent_application_id) {
        // This is a primary registrant
        if (!groups.has(reg.application_id)) {
          groups.set(reg.application_id, [reg]);
        }
      }
    });

    // Second pass: add dependent registrants to their groups
    filteredRegistrations.forEach(reg => {
      if (reg.parent_application_id) {
        const parentGroup = groups.get(reg.parent_application_id);
        if (parentGroup) {
          parentGroup.push(reg);
        } else {
          // Parent not in filtered results, create a new group
          if (!groups.has(reg.parent_application_id)) {
            groups.set(reg.parent_application_id, []);
          }
          groups.get(reg.parent_application_id)!.push(reg);
        }
      }
    });

    // Identify standalone registrations (primary with no dependents in results)
    groups.forEach((members, key) => {
      if (members.length === 1 && !members[0].parent_application_id) {
        // Check if there are any dependents for this registration
        const hasDependents = filteredRegistrations.some(r => r.parent_application_id === key);
        if (!hasDependents) {
          standalone.push(members[0]);
          groups.delete(key);
        }
      }
    });

    return { groups, standalone };
  };

  const sendNotificationEmail = async (
    registration: Registration, 
    type: 'approved' | 'rejected',
    rejectionReason?: string
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-registration-email', {
        body: {
          to: registration.email,
          name: registration.name,
          applicationId: registration.application_id,
          type,
          rejectionReason,
        },
      });

      if (error) {
        console.error('Error sending email:', error);
        toast({
          title: 'Email Warning',
          description: 'Registration updated but email notification failed to send.',
          variant: 'destructive',
        });
        return false;
      }

      console.log('Email sent:', data);
      return true;
    } catch (err) {
      console.error('Email error:', err);
      return false;
    }
  };

  const handleApprove = async (registration: Registration) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('registrations')
        .update({
          registration_status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', registration.id);

      if (error) throw error;

      // Send notification email
      const emailSent = await sendNotificationEmail(registration, 'approved');

      toast({
        title: 'Registration Approved',
        description: emailSent 
          ? `${registration.name}'s registration has been approved and notification sent.`
          : `${registration.name}'s registration has been approved.`,
      });

      fetchRegistrations();
      setIsDetailOpen(false);
    } catch (error) {
      console.error('Error approving registration:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve registration',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRegistration || !rejectionReason.trim()) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('registrations')
        .update({
          registration_status: 'rejected',
          rejection_reason: rejectionReason,
        })
        .eq('id', selectedRegistration.id);

      if (error) throw error;

      // Send notification email
      const emailSent = await sendNotificationEmail(selectedRegistration, 'rejected', rejectionReason);

      toast({
        title: 'Registration Rejected',
        description: emailSent
          ? `${selectedRegistration.name}'s registration has been rejected and notification sent.`
          : `${selectedRegistration.name}'s registration has been rejected.`,
      });

      fetchRegistrations();
      setIsRejectDialogOpen(false);
      setIsDetailOpen(false);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting registration:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject registration',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRegistration) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('registrations')
        .delete()
        .eq('id', selectedRegistration.id);

      if (error) throw error;

      toast({
        title: 'Registration Deleted',
        description: `${selectedRegistration.name}'s registration has been permanently deleted.`,
      });

      fetchRegistrations();
      setIsDeleteDialogOpen(false);
      setIsDetailOpen(false);
    } catch (error) {
      console.error('Error deleting registration:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete registration',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle group approval - approve all pending members in the group
  const handleGroupApprove = async (members: Registration[]) => {
    const pendingMembers = members.filter(m => m.registration_status === 'pending');
    if (pendingMembers.length === 0) {
      toast({
        title: 'No Pending Registrations',
        description: 'All members in this group are already processed.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const memberIds = pendingMembers.map(m => m.id);
      const { error } = await supabase
        .from('registrations')
        .update({
          registration_status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .in('id', memberIds);

      if (error) throw error;

      // Send notification emails to all approved members
      const emailPromises = pendingMembers.map(member => 
        sendNotificationEmail(member, 'approved')
      );
      await Promise.all(emailPromises);

      toast({
        title: 'Group Approved',
        description: `${pendingMembers.length} registration(s) have been approved.`,
      });

      fetchRegistrations();
    } catch (error) {
      console.error('Error approving group:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve group registrations',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle group rejection - reject all pending members in the group
  const handleGroupReject = async () => {
    if (!selectedGroup || !groupRejectionReason.trim()) return;

    const pendingMembers = selectedGroup.filter(m => m.registration_status === 'pending');
    if (pendingMembers.length === 0) {
      toast({
        title: 'No Pending Registrations',
        description: 'All members in this group are already processed.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const memberIds = pendingMembers.map(m => m.id);
      const { error } = await supabase
        .from('registrations')
        .update({
          registration_status: 'rejected',
          rejection_reason: groupRejectionReason,
        })
        .in('id', memberIds);

      if (error) throw error;

      // Send notification emails to all rejected members
      const emailPromises = pendingMembers.map(member => 
        sendNotificationEmail(member, 'rejected', groupRejectionReason)
      );
      await Promise.all(emailPromises);

      toast({
        title: 'Group Rejected',
        description: `${pendingMembers.length} registration(s) have been rejected.`,
      });

      fetchRegistrations();
      setIsGroupRejectDialogOpen(false);
      setSelectedGroup(null);
      setGroupRejectionReason('');
    } catch (error) {
      console.error('Error rejecting group:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject group registrations',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-secondary text-secondary-foreground">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="border-accent text-accent">Pending</Badge>;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-secondary text-secondary-foreground">Verified</Badge>;
      case 'submitted':
        return <Badge className="bg-accent text-accent-foreground">Submitted</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  // Check if a group has any pending registrations
  const hasGroupPendingRegistrations = (members: Registration[]) => {
    return members.some(m => m.registration_status === 'pending');
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Registrations</h1>
            <p className="text-muted-foreground mt-1">
              Manage alumni registrations
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setShowGrouped(!showGrouped)} 
              variant={showGrouped ? "default" : "outline"} 
              size="sm"
            >
              <Users className="h-4 w-4 mr-2" />
              {showGrouped ? 'Grouped' : 'Flat'}
            </Button>
            <Button onClick={fetchRegistrations} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or application ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredRegistrations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No registrations found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Hostel</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {showGrouped ? (
                      <>
                        {/* Grouped registrations */}
                        {(() => {
                          const { groups, standalone } = getGroupedRegistrations();
                          return (
                            <>
                              {Array.from(groups.entries()).map(([groupId, members]) => (
                                <React.Fragment key={groupId}>
                                  {/* Group header row */}
                                  <TableRow className="bg-primary/5 border-l-4 border-l-primary">
                                    <TableCell colSpan={6} className="py-2">
                                      <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4 text-primary" />
                                        <span className="font-semibold text-primary">
                                          Group: {groupId}
                                        </span>
                                        <Badge variant="secondary" className="ml-2">
                                          {members.length} member{members.length > 1 ? 's' : ''}
                                        </Badge>
                                        {hasGroupPendingRegistrations(members) && (
                                          <Badge variant="outline" className="border-accent text-accent">
                                            {members.filter(m => m.registration_status === 'pending').length} pending
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell colSpan={4} className="text-right py-2">
                                      {hasGroupPendingRegistrations(members) && (
                                        <div className="flex items-center justify-end gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setSelectedGroup(members);
                                              setIsGroupRejectDialogOpen(true);
                                            }}
                                            disabled={isProcessing}
                                            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                                          >
                                            <XOctagon className="h-4 w-4 mr-1" />
                                            Reject All
                                          </Button>
                                          <Button
                                            size="sm"
                                            onClick={() => handleGroupApprove(members)}
                                            disabled={isProcessing}
                                          >
                                            {isProcessing ? (
                                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                            ) : (
                                              <CheckCheck className="h-4 w-4 mr-1" />
                                            )}
                                            Approve All
                                          </Button>
                                        </div>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                  {/* Group members */}
                                  {members.map((registration, index) => (
                                    <TableRow 
                                      key={registration.id}
                                      className={`${index === 0 ? 'bg-primary/10' : 'bg-muted/30'} border-l-4 ${index === 0 ? 'border-l-primary' : 'border-l-muted-foreground/30'}`}
                                    >
                                      <TableCell className="font-mono text-sm">
                                        <div className="flex items-center gap-2">
                                          {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                          {registration.application_id}
                                          {index === 0 && (
                                            <Badge variant="outline" className="text-xs">Primary</Badge>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="font-medium">{registration.name}</TableCell>
                                      <TableCell>{registration.email}</TableCell>
                                      <TableCell>{registration.year_of_passing}</TableCell>
                                      <TableCell>{getStatusBadge(registration.registration_status)}</TableCell>
                                      <TableCell>{getPaymentBadge(registration.payment_status)}</TableCell>
                                      <TableCell>
                                        {registration.registration_status === 'approved' && registration.stay_type === 'on-campus' ? (
                                          <Select
                                            value={registration.hostel_name || ''}
                                            onValueChange={(value) => handleHostelAssign(registration, value)}
                                          >
                                            <SelectTrigger className="w-28 h-8 text-xs">
                                              <SelectValue placeholder="Assign" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {HOSTEL_OPTIONS.map((hostel) => (
                                                <SelectItem key={hostel} value={hostel} className="capitalize">
                                                  {hostel.charAt(0).toUpperCase() + hostel.slice(1)}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        ) : registration.hostel_name ? (
                                          <Badge variant="secondary" className="capitalize">
                                            {registration.hostel_name}
                                          </Badge>
                                        ) : (
                                          <span className="text-muted-foreground text-xs">
                                            {registration.stay_type === 'outside' ? 'N/A' : '-'}
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {format(new Date(registration.created_at), 'MMM d, yyyy')}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setSelectedRegistration(registration);
                                            setIsDetailOpen(true);
                                          }}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </React.Fragment>
                              ))}
                              {/* Standalone registrations */}
                              {standalone.map((registration) => (
                                <TableRow key={registration.id}>
                                  <TableCell className="font-mono text-sm">
                                    {registration.application_id}
                                  </TableCell>
                                  <TableCell className="font-medium">{registration.name}</TableCell>
                                  <TableCell>{registration.email}</TableCell>
                                  <TableCell>{registration.year_of_passing}</TableCell>
                                  <TableCell>{getStatusBadge(registration.registration_status)}</TableCell>
                                  <TableCell>{getPaymentBadge(registration.payment_status)}</TableCell>
                                  <TableCell>
                                    {registration.registration_status === 'approved' && registration.stay_type === 'on-campus' ? (
                                      <Select
                                        value={registration.hostel_name || ''}
                                        onValueChange={(value) => handleHostelAssign(registration, value)}
                                      >
                                        <SelectTrigger className="w-28 h-8 text-xs">
                                          <SelectValue placeholder="Assign" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {HOSTEL_OPTIONS.map((hostel) => (
                                            <SelectItem key={hostel} value={hostel} className="capitalize">
                                              {hostel.charAt(0).toUpperCase() + hostel.slice(1)}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : registration.hostel_name ? (
                                      <Badge variant="secondary" className="capitalize">
                                        {registration.hostel_name}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">
                                        {registration.stay_type === 'outside' ? 'N/A' : '-'}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {format(new Date(registration.created_at), 'MMM d, yyyy')}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedRegistration(registration);
                                        setIsDetailOpen(true);
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      /* Flat view - original behavior */
                      filteredRegistrations.map((registration) => (
                        <TableRow key={registration.id}>
                          <TableCell className="font-mono text-sm">
                            <div className="flex items-center gap-2">
                              {registration.application_id}
                              {registration.parent_application_id && (
                                <Badge variant="outline" className="text-xs">
                                  → {registration.parent_application_id}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{registration.name}</TableCell>
                          <TableCell>{registration.email}</TableCell>
                          <TableCell>{registration.year_of_passing}</TableCell>
                          <TableCell>{getStatusBadge(registration.registration_status)}</TableCell>
                          <TableCell>{getPaymentBadge(registration.payment_status)}</TableCell>
                          <TableCell>
                            {registration.registration_status === 'approved' && registration.stay_type === 'on-campus' ? (
                              <Select
                                value={registration.hostel_name || ''}
                                onValueChange={(value) => handleHostelAssign(registration, value)}
                              >
                                <SelectTrigger className="w-28 h-8 text-xs">
                                  <SelectValue placeholder="Assign" />
                                </SelectTrigger>
                                <SelectContent>
                                  {HOSTEL_OPTIONS.map((hostel) => (
                                    <SelectItem key={hostel} value={hostel} className="capitalize">
                                      {hostel.charAt(0).toUpperCase() + hostel.slice(1)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : registration.hostel_name ? (
                              <Badge variant="secondary" className="capitalize">
                                {registration.hostel_name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                {registration.stay_type === 'outside' ? 'N/A' : '-'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(registration.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedRegistration(registration);
                                setIsDetailOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Registration Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Registration Details</DialogTitle>
            <DialogDescription>
              Application ID: {selectedRegistration?.application_id}
            </DialogDescription>
          </DialogHeader>

          {selectedRegistration && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Name</label>
                  <p className="font-medium">{selectedRegistration.name}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Gender</label>
                  <p className="font-medium capitalize">{selectedRegistration.gender}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Email</label>
                  <p className="font-medium">{selectedRegistration.email}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Phone</label>
                  <p className="font-medium">{selectedRegistration.phone}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Year of Passing</label>
                  <p className="font-medium">{selectedRegistration.year_of_passing}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Occupation</label>
                  <p className="font-medium">{selectedRegistration.occupation}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Stay Type</label>
                  <p className="font-medium capitalize">{selectedRegistration.stay_type}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">T-Shirt Size</label>
                  <p className="font-medium">{selectedRegistration.tshirt_size}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Registration Fee</label>
                  <p className="font-medium">₹{selectedRegistration.registration_fee}</p>
                </div>
                {/* Hostel Assignment - Only for approved on-campus registrations */}
                {selectedRegistration.stay_type === 'on-campus' && (
                  <div>
                    <label className="text-sm text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      Hostel Accommodation
                    </label>
                    {selectedRegistration.registration_status === 'approved' ? (
                      <Select
                        value={selectedRegistration.hostel_name || ''}
                        onValueChange={(value) => handleHostelAssign(selectedRegistration, value)}
                      >
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue placeholder="Select hostel" />
                        </SelectTrigger>
                        <SelectContent>
                          {HOSTEL_OPTIONS.map((hostel) => (
                            <SelectItem key={hostel} value={hostel} className="capitalize">
                              {hostel.charAt(0).toUpperCase() + hostel.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-medium text-muted-foreground mt-1">
                        {selectedRegistration.hostel_name 
                          ? selectedRegistration.hostel_name.charAt(0).toUpperCase() + selectedRegistration.hostel_name.slice(1)
                          : 'Pending approval'}
                      </p>
                    )}
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground">Payment Proof</label>
                  {selectedRegistration.payment_proof_url ? (
                    <div className="mt-2">
                      {selectedRegistration.payment_proof_url.toLowerCase().endsWith('.pdf') ? (
                        <a 
                          href={selectedRegistration.payment_proof_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-primary hover:underline"
                        >
                          <Eye className="h-4 w-4" />
                          View PDF Payment Proof
                        </a>
                      ) : (
                        <a 
                          href={selectedRegistration.payment_proof_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <img 
                            src={selectedRegistration.payment_proof_url} 
                            alt="Payment proof" 
                            className="max-w-full max-h-64 rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="font-medium text-muted-foreground">No proof uploaded</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Address</label>
                <p className="font-medium">
                  {selectedRegistration.address_line1}
                  {selectedRegistration.address_line2 && `, ${selectedRegistration.address_line2}`}
                  <br />
                  {selectedRegistration.city}, {selectedRegistration.district}
                  <br />
                  {selectedRegistration.state} - {selectedRegistration.postal_code}
                  <br />
                  {selectedRegistration.country}
                </p>
              </div>

              <div className="flex gap-2">
                <div>
                  <label className="text-sm text-muted-foreground">Registration Status</label>
                  <div className="mt-1">{getStatusBadge(selectedRegistration.registration_status)}</div>
                </div>
                <div className="ml-4">
                  <label className="text-sm text-muted-foreground">Payment Status</label>
                  <div className="mt-1">{getPaymentBadge(selectedRegistration.payment_status)}</div>
                </div>
              </div>

              {selectedRegistration.rejection_reason && (
                <div>
                  <label className="text-sm text-muted-foreground">Rejection Reason</label>
                  <p className="font-medium text-destructive">{selectedRegistration.rejection_reason}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {userRole === 'superadmin' && (
              <Button
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isProcessing}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            {selectedRegistration?.registration_status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsRejectDialogOpen(true)}
                  disabled={isProcessing}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => selectedRegistration && handleApprove(selectedRegistration)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Reject Registration</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this registration.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isProcessing || !rejectionReason.trim()}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject Registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Registration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete the registration for{' '}
              <span className="font-semibold">{selectedRegistration?.name}</span>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Group Rejection Dialog */}
      <Dialog open={isGroupRejectDialogOpen} onOpenChange={(open) => {
        setIsGroupRejectDialogOpen(open);
        if (!open) {
          setSelectedGroup(null);
          setGroupRejectionReason('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Reject Entire Group</DialogTitle>
            <DialogDescription>
              This will reject {selectedGroup?.filter(m => m.registration_status === 'pending').length || 0} pending registration(s) in this group.
              Please provide a reason for the rejection.
            </DialogDescription>
          </DialogHeader>
          {selectedGroup && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">Members to be rejected:</p>
                <ul className="list-disc list-inside space-y-1">
                  {selectedGroup
                    .filter(m => m.registration_status === 'pending')
                    .map(m => (
                      <li key={m.id}>{m.name} ({m.application_id})</li>
                    ))}
                </ul>
              </div>
              <Textarea
                placeholder="Enter rejection reason for all group members..."
                value={groupRejectionReason}
                onChange={(e) => setGroupRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsGroupRejectDialogOpen(false);
                setSelectedGroup(null);
                setGroupRejectionReason('');
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleGroupReject}
              disabled={isProcessing || !groupRejectionReason.trim()}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XOctagon className="h-4 w-4 mr-2" />
              )}
              Reject All ({selectedGroup?.filter(m => m.registration_status === 'pending').length || 0})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminRegistrations;
