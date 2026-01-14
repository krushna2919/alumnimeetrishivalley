import { useEffect, useState } from 'react';
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
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { Tables } from '@/integrations/supabase/types';

type Registration = Tables<'registrations'>;

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
  
  const { toast } = useToast();
  const { userRole } = useAuth();

  useEffect(() => {
    fetchRegistrations();
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
          <Button onClick={fetchRegistrations} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
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
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegistrations.map((registration) => (
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
                <div>
                  <label className="text-sm text-muted-foreground">Payment Reference</label>
                  <p className="font-medium">{selectedRegistration.payment_reference || 'N/A'}</p>
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
    </AdminLayout>
  );
};

export default AdminRegistrations;
