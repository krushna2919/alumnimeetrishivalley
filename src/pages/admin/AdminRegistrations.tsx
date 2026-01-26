import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { logAdminActivity } from '@/lib/activityLogger';
import { 
  Search, 
  Loader2, 
  Eye, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Link2,
  Mail,
  Trash2,
  Users,
  ChevronRight,
  CheckCheck,
  XOctagon,
  Building2,
  ChevronLeft,
  Pencil
} from 'lucide-react';
import EditRegistrationDialog from '@/components/admin/EditRegistrationDialog';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { format } from 'date-fns';
import { Tables } from '@/integrations/supabase/types';
import { resolveLatestPaymentProofUrlFromStorage } from '@/lib/paymentProofResolver';

type Registration = Tables<'registrations'>;

// Hostel options fetched from database

const AdminRegistrations = () => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFromFilter, setYearFromFilter] = useState<string>('');
  const [yearToFilter, setYearToFilter] = useState<string>('');
  const [stayTypeFilter, setStayTypeFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [boardTypeFilter, setBoardTypeFilter] = useState<string>('all');
  const [hostelFilter, setHostelFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [hostelOptions, setHostelOptions] = useState<string[]>([]);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncingProofs, setIsSyncingProofs] = useState(false);
  const [showGrouped, setShowGrouped] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Registration[] | null>(null);
  const [isGroupRejectDialogOpen, setIsGroupRejectDialogOpen] = useState(false);
  const [groupRejectionReason, setGroupRejectionReason] = useState('');
  
  // Bulk hostel assignment state
  const [selectedForHostel, setSelectedForHostel] = useState<Set<string>>(new Set());
  const [isBulkHostelDialogOpen, setIsBulkHostelDialogOpen] = useState(false);
  const [bulkHostelSelection, setBulkHostelSelection] = useState<string>('');
  
  // Edit registration dialog state (superadmin only)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Resend approval email state (superadmin only)
  const [isResendEmailDialogOpen, setIsResendEmailDialogOpen] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  
  // Single application sync state
  const [isSyncingSingleProof, setIsSyncingSingleProof] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  const { toast } = useToast();
  const { userRole, user } = useAuth();

  const toPublicPaymentProofUrl = (value: string | null) => {
    if (!value) return null;
    // DB normally stores a public URL, but older/migrated records may store just the storage path.
    if (/^https?:\/\//i.test(value)) return value;
    return supabase.storage.from('payment-proofs').getPublicUrl(value).data.publicUrl;
  };

  const toPublicPaymentReceiptUrl = (value: string | null) => {
    if (!value) return null;
    // DB should store a public URL. For legacy/migrated records it might store just the storage path.
    // IMPORTANT: do not rewrite existing URLs between buckets here; that must be handled by a migration.
    if (/^https?:\/\//i.test(value)) return value;
    return supabase.storage.from('payment-receipts').getPublicUrl(value).data.publicUrl;
  };

  const resolvePaymentProofUrlFromStorage = (applicationId: string) =>
    resolveLatestPaymentProofUrlFromStorage(applicationId, { bucket: 'payment-proofs' });

  const backfillMissingPaymentProofUrls = async (rows: Registration[]) => {
    const missing = rows.filter((r) => r.payment_status === 'submitted' && !r.payment_proof_url);
    if (missing.length === 0) return;

    const toResolve = missing.slice(0, 10);
    await Promise.allSettled(
      toResolve.map(async (r) => {
        const resolvedUrl = await resolvePaymentProofUrlFromStorage(r.application_id);
        if (!resolvedUrl) return;
        const { error } = await supabase
          .from('registrations')
          .update({ payment_proof_url: resolvedUrl, updated_at: new Date().toISOString() })
          .eq('id', r.id);

        if (error) console.error('Failed to backfill payment_proof_url:', error);
      })
    );
  };

  // Sync all missing payment proofs from storage (superadmin only)
  // Also links group members to their parent's combined payment proof
  const syncMissingProofs = async () => {
    setIsSyncingProofs(true);
    try {
      // Fetch all registrations with missing proof URL
      const { data: pendingRecords, error: fetchError } = await supabase
        .from('registrations')
        .select('id, application_id, payment_status, payment_proof_url, parent_application_id')
        .is('payment_proof_url', null)
        .in('payment_status', ['pending', 'submitted']);

      if (fetchError) throw fetchError;

      if (!pendingRecords || pendingRecords.length === 0) {
        toast({
          title: 'No Missing Proofs',
          description: 'All payment proofs are already linked.',
        });
        return;
      }

      // Fetch parent registrations that have proofs (for group linking)
      const parentIds = [...new Set(pendingRecords
        .filter(r => r.parent_application_id)
        .map(r => r.parent_application_id as string))];

      let parentProofMap: Record<string, string> = {};
      if (parentIds.length > 0) {
        const { data: parentData } = await supabase
          .from('registrations')
          .select('application_id, payment_proof_url')
          .in('application_id', parentIds)
          .not('payment_proof_url', 'is', null);

        if (parentData) {
          parentProofMap = parentData.reduce((acc, p) => {
            if (p.payment_proof_url) acc[p.application_id] = p.payment_proof_url;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      let linkedCount = 0;
      
      // Process in parallel
      await Promise.allSettled(
        pendingRecords.map(async (record) => {
          let resolvedUrl: string | null = null;

          // First check if this is a group member with a parent that has a proof
          if (record.parent_application_id && parentProofMap[record.parent_application_id]) {
            resolvedUrl = parentProofMap[record.parent_application_id];
          } else {
            // Try to find a proof directly from storage for this application
            resolvedUrl = await resolvePaymentProofUrlFromStorage(record.application_id);
          }

          if (!resolvedUrl) return;

          const { error: updateError } = await supabase
            .from('registrations')
            .update({
              payment_proof_url: resolvedUrl,
              payment_status: 'submitted',
              updated_at: new Date().toISOString(),
            })
            .eq('id', record.id);

          if (!updateError) {
            linkedCount++;
          } else {
            console.error(`Failed to link proof for ${record.application_id}:`, updateError);
          }
        })
      );

      toast({
        title: 'Sync Complete',
        description: linkedCount > 0
          ? `Successfully linked ${linkedCount} payment proof(s) (including group members).`
          : 'No matching files found in storage.',
      });

      if (linkedCount > 0) {
        fetchRegistrations();
      }
    } catch (error) {
      console.error('Error syncing proofs:', error);
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync payment proofs from storage.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingProofs(false);
    }
  };

  // Sync payment proof for a single application (and its group members)
  const syncSingleApplicationProof = async (applicationId: string) => {
    setIsSyncingSingleProof(true);
    try {
      // Get all registrations for this application (parent + dependents)
      const { data: records, error: fetchError } = await supabase
        .from('registrations')
        .select('id, application_id, payment_proof_url, parent_application_id')
        .or(`application_id.eq.${applicationId},parent_application_id.eq.${applicationId}`);

      if (fetchError) throw fetchError;
      if (!records || records.length === 0) {
        toast({ title: 'Not Found', description: 'No records found for this application ID.', variant: 'destructive' });
        return;
      }

      // Try to find the proof from storage
      const resolvedUrl = await resolvePaymentProofUrlFromStorage(applicationId);
      
      if (!resolvedUrl) {
        toast({ title: 'No Proof Found', description: `No payment proof file found in storage for ${applicationId}. Check that the file name starts with "${applicationId}-" or "combined-${applicationId}-".`, variant: 'destructive' });
        return;
      }

      // Update all records (parent + dependents) with the resolved URL
      let updatedCount = 0;
      for (const record of records) {
        const { error: updateError } = await supabase
          .from('registrations')
          .update({
            payment_proof_url: resolvedUrl,
            payment_status: 'submitted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);

        if (!updateError) updatedCount++;
      }

      toast({
        title: 'Proof Linked',
        description: `Successfully linked payment proof to ${updatedCount} record(s).`,
      });

      fetchRegistrations();
      
      // Update selected registration if still open
      if (selectedRegistration && (selectedRegistration.application_id === applicationId || selectedRegistration.parent_application_id === applicationId)) {
        setSelectedRegistration(prev => prev ? { ...prev, payment_proof_url: resolvedUrl, payment_status: 'submitted' } : null);
      }
    } catch (error) {
      console.error('Error syncing single proof:', error);
      toast({ title: 'Sync Failed', description: 'Failed to sync payment proof.', variant: 'destructive' });
    } finally {
      setIsSyncingSingleProof(false);
    }
  };

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

  // Handle bulk hostel assignment
  const handleBulkHostelAssign = async () => {
    if (!bulkHostelSelection || selectedForHostel.size === 0) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('registrations')
        .update({ hostel_name: bulkHostelSelection })
        .in('id', Array.from(selectedForHostel));

      if (error) throw error;

      toast({
        title: 'Hostels Assigned',
        description: `${selectedForHostel.size} registration(s) assigned to ${bulkHostelSelection.charAt(0).toUpperCase() + bulkHostelSelection.slice(1)} hostel.`,
      });

      setSelectedForHostel(new Set());
      setBulkHostelSelection('');
      setIsBulkHostelDialogOpen(false);
      fetchRegistrations();
    } catch (error) {
      console.error('Error bulk assigning hostels:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign hostels',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle selection for bulk hostel assignment
  const toggleHostelSelection = (id: string) => {
    setSelectedForHostel(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Get eligible registrations for hostel assignment (approved + on-campus)
  const getHostelEligibleRegistrations = () => {
    return filteredRegistrations.filter(
      r => r.registration_status === 'approved' && r.stay_type === 'on-campus'
    );
  };

  // Select/deselect all eligible registrations
  const toggleSelectAllHostel = () => {
    const eligible = getHostelEligibleRegistrations();
    if (selectedForHostel.size === eligible.length) {
      setSelectedForHostel(new Set());
    } else {
      setSelectedForHostel(new Set(eligible.map(r => r.id)));
    }
  };

  // Fetch hostels from database for filter dropdown
  const fetchHostels = async () => {
    try {
      const { data, error } = await supabase
        .from('hostels')
        .select('name')
        .order('name');
      
      if (error) throw error;
      setHostelOptions((data || []).map(h => h.name));
    } catch (error) {
      console.error('Error fetching hostels:', error);
    }
  };

  useEffect(() => {
    fetchRegistrations();
    fetchHostels();

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
    setCurrentPage(1); // Reset to first page when filters change
  }, [registrations, searchQuery, statusFilter, yearFromFilter, yearToFilter, stayTypeFilter, genderFilter, boardTypeFilter, hostelFilter, paymentStatusFilter]);

  const fetchRegistrations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = (data || []) as Registration[];
      setRegistrations(rows);

      // Ensure admins can always see payment proofs even if a registration was created
      // but the client-side DB link failed right after upload.
      void backfillMissingPaymentProofUrls(rows);
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

    // Year range filter
    if (yearFromFilter !== '') {
      const fromYear = parseInt(yearFromFilter, 10);
      if (!isNaN(fromYear)) {
        filtered = filtered.filter((r) => r.year_of_passing >= fromYear);
      }
    }
    if (yearToFilter !== '') {
      const toYear = parseInt(yearToFilter, 10);
      if (!isNaN(toYear)) {
        filtered = filtered.filter((r) => r.year_of_passing <= toYear);
      }
    }

    if (stayTypeFilter !== 'all') {
      filtered = filtered.filter((r) => r.stay_type === stayTypeFilter);
    }

    if (genderFilter !== 'all') {
      filtered = filtered.filter((r) => r.gender === genderFilter);
    }

    if (boardTypeFilter !== 'all') {
      filtered = filtered.filter((r) => r.board_type === boardTypeFilter);
    }

    if (hostelFilter !== 'all') {
      if (hostelFilter === 'unassigned') {
        filtered = filtered.filter((r) => !r.hostel_name);
      } else {
        filtered = filtered.filter((r) => r.hostel_name === hostelFilter);
      }
    }

    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter((r) => r.payment_status === paymentStatusFilter);
    }

    setFilteredRegistrations(filtered);
  };

  // Get unique years from registrations for filter dropdown
  const getUniqueYears = () => {
    const years = [...new Set(registrations.map(r => r.year_of_passing))].sort((a, b) => b - a);
    return years;
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setYearFromFilter('');
    setYearToFilter('');
    setStayTypeFilter('all');
    setGenderFilter('all');
    setBoardTypeFilter('all');
    setHostelFilter('all');
    setPaymentStatusFilter('all');
  };

  // Check if any filter is active
  const hasActiveFilters = () => {
    return searchQuery !== '' || 
           statusFilter !== 'all' || 
           yearFromFilter !== '' ||
           yearToFilter !== '' ||
           stayTypeFilter !== 'all' || 
           genderFilter !== 'all' || 
           boardTypeFilter !== 'all' || 
           hostelFilter !== 'all' || 
           paymentStatusFilter !== 'all';
  };

  // Group registrations by parent_application_id (uses paginated data)
  const getGroupedRegistrations = (registrationsToGroup: Registration[]) => {
    const groups: Map<string, Registration[]> = new Map();
    const standalone: Registration[] = [];

    // First pass: identify primary registrants (those without parent_application_id)
    registrationsToGroup.forEach(reg => {
      if (!reg.parent_application_id) {
        // This is a primary registrant
        if (!groups.has(reg.application_id)) {
          groups.set(reg.application_id, [reg]);
        }
      }
    });

    // Second pass: add dependent registrants to their groups
    registrationsToGroup.forEach(reg => {
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
        const hasDependents = registrationsToGroup.some(r => r.parent_application_id === key);
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
          paymentReceiptUrl: type === 'approved' ? registration.payment_receipt_url : undefined,
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
      // Send notification email FIRST before approving
      const emailSent = await sendNotificationEmail(registration, 'approved');

      if (!emailSent) {
        toast({
          title: 'Email Sending Failed',
          description: `Could not send approval email to ${registration.email}. Registration was NOT approved. Please try again or check email configuration.`,
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      // Only approve if email was sent successfully
      const { error } = await supabase
        .from('registrations')
        .update({
          registration_status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
          approval_email_sent: true,
        })
        .eq('id', registration.id);

      if (error) throw error;

      // Log registration approval activity
      await logAdminActivity({
        actionType: 'registration_approval',
        targetRegistrationId: registration.id,
        targetApplicationId: registration.application_id,
        details: { 
          name: registration.name,
          email: registration.email,
          registrationFee: registration.registration_fee 
        }
      });

      toast({
        title: 'Registration Approved',
        description: `${registration.name}'s registration has been approved and notification email sent successfully.`,
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
      // Send notification email FIRST before rejecting
      const emailSent = await sendNotificationEmail(selectedRegistration, 'rejected', rejectionReason);

      if (!emailSent) {
        toast({
          title: 'Email Sending Failed',
          description: `Could not send rejection email to ${selectedRegistration.email}. Registration was NOT rejected. Please try again or check email configuration.`,
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      // Only reject if email was sent successfully
      const { error } = await supabase
        .from('registrations')
        .update({
          registration_status: 'rejected',
          rejection_reason: rejectionReason,
          approval_email_sent: true,
        })
        .eq('id', selectedRegistration.id);

      if (error) throw error;

      // Log registration rejection activity
      await logAdminActivity({
        actionType: 'registration_rejection',
        targetRegistrationId: selectedRegistration.id,
        targetApplicationId: selectedRegistration.application_id,
        details: { 
          name: selectedRegistration.name,
          rejectionReason 
        }
      });

      toast({
        title: 'Registration Rejected',
        description: `${selectedRegistration.name}'s registration has been rejected and notification email sent successfully.`,
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

  // Handle re-enabling expired registration (superadmin only)
  const handleReEnableRegistration = async (registration: Registration) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('registrations')
        .update({
          registration_status: 'pending',
          rejection_reason: null,
        })
        .eq('id', registration.id);

      if (error) throw error;

      toast({
        title: 'Registration Re-enabled',
        description: `${registration.name}'s registration has been re-enabled for processing.`,
      });

      fetchRegistrations();
      setIsDetailOpen(false);
    } catch (error) {
      console.error('Error re-enabling registration:', error);
      toast({
        title: 'Error',
        description: 'Failed to re-enable registration',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if group has approvable registrations (pending + payment submitted + accounts verified)
  const hasGroupApprovableRegistrations = (members: Registration[]) => {
    return members.some(m => m.registration_status === 'pending' && m.payment_status === 'submitted' && m.accounts_verified);
  };

  // Handle group approval - approve all pending members with submitted payment and verified accounts in the group
  const handleGroupApprove = async (members: Registration[]) => {
    const approvableMembers = members.filter(m => m.registration_status === 'pending' && m.payment_status === 'submitted' && m.accounts_verified);
    if (approvableMembers.length === 0) {
      toast({
        title: 'No Approvable Registrations',
        description: 'No members with verified payment are pending approval.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Send notification emails FIRST before approving
      const emailResults = await Promise.all(
        approvableMembers.map(async (member) => ({
          member,
          success: await sendNotificationEmail(member, 'approved'),
        }))
      );

      const failedEmails = emailResults.filter(r => !r.success);
      const successfulEmails = emailResults.filter(r => r.success);

      if (failedEmails.length > 0) {
        const failedNames = failedEmails.map(r => r.member.name).join(', ');
        toast({
          title: 'Email Sending Failed',
          description: `Could not send approval emails to: ${failedNames}. These registrations were NOT approved.`,
          variant: 'destructive',
        });
      }

      // Only approve registrations where email was sent successfully
      if (successfulEmails.length > 0) {
        const successfulIds = successfulEmails.map(r => r.member.id);
        const { error } = await supabase
          .from('registrations')
          .update({
            registration_status: 'approved',
            approved_at: new Date().toISOString(),
            approval_email_sent: true,
          })
          .in('id', successfulIds);

        if (error) throw error;

        toast({
          title: 'Group Approved',
          description: `${successfulEmails.length} registration(s) have been approved and notified.${failedEmails.length > 0 ? ` ${failedEmails.length} failed.` : ''}`,
        });
      }

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
      // Send notification emails FIRST before rejecting
      const emailResults = await Promise.all(
        pendingMembers.map(async (member) => ({
          member,
          success: await sendNotificationEmail(member, 'rejected', groupRejectionReason),
        }))
      );

      const failedEmails = emailResults.filter(r => !r.success);
      const successfulEmails = emailResults.filter(r => r.success);

      if (failedEmails.length > 0) {
        const failedNames = failedEmails.map(r => r.member.name).join(', ');
        toast({
          title: 'Email Sending Failed',
          description: `Could not send rejection emails to: ${failedNames}. These registrations were NOT rejected.`,
          variant: 'destructive',
        });
      }

      // Only reject registrations where email was sent successfully
      if (successfulEmails.length > 0) {
        const successfulIds = successfulEmails.map(r => r.member.id);
        const { error } = await supabase
          .from('registrations')
          .update({
            registration_status: 'rejected',
            rejection_reason: groupRejectionReason,
            approval_email_sent: true,
          })
          .in('id', successfulIds);

        if (error) throw error;

        toast({
          title: 'Group Rejected',
          description: `${successfulEmails.length} registration(s) have been rejected and notified.${failedEmails.length > 0 ? ` ${failedEmails.length} failed.` : ''}`,
        });

        setIsGroupRejectDialogOpen(false);
        setSelectedGroup(null);
        setGroupRejectionReason('');
      }

      fetchRegistrations();
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

  const getStatusBadge = (status: string, accountsVerified?: boolean) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-secondary text-secondary-foreground">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'expired':
        return <Badge variant="outline" className="border-destructive text-destructive">Expired</Badge>;
      default:
        // Show different pending status based on accounts verification
        if (accountsVerified) {
          return <Badge className="bg-accent text-accent-foreground">Ready for Final Approval</Badge>;
        }
        return <Badge variant="outline" className="border-accent text-accent">Pending Account Review</Badge>;
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

  // Pagination logic
  const totalItems = filteredRegistrations.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRegistrations = filteredRegistrations.slice(startIndex, endIndex);

  const getVisiblePageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
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
            {selectedForHostel.size > 0 && (
              <Button 
                onClick={() => setIsBulkHostelDialogOpen(true)}
                size="sm"
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Building2 className="h-4 w-4 mr-2" />
                Assign Hostel ({selectedForHostel.size})
              </Button>
            )}
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
            {userRole === 'superadmin' && (
              <Button 
                onClick={syncMissingProofs} 
                variant="outline" 
                size="sm"
                disabled={isSyncingProofs}
              >
                {isSyncingProofs ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Sync Missing Proofs
              </Button>
            )}
          </div>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <div className="space-y-4">
              {/* Search and primary filters row */}
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
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Additional filters row */}
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    placeholder="From Year"
                    value={yearFromFilter}
                    onChange={(e) => setYearFromFilter(e.target.value)}
                    className="w-[100px]"
                    min={1900}
                    max={2100}
                  />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input
                    type="number"
                    placeholder="To Year"
                    value={yearToFilter}
                    onChange={(e) => setYearToFilter(e.target.value)}
                    className="w-[100px]"
                    min={1900}
                    max={2100}
                  />
                </div>

                <Select value={stayTypeFilter} onValueChange={setStayTypeFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Stay Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stay</SelectItem>
                    <SelectItem value="on-campus">On-Campus</SelectItem>
                    <SelectItem value="outside">Outside</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={genderFilter} onValueChange={setGenderFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Gender</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={boardTypeFilter} onValueChange={setBoardTypeFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Board" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Boards</SelectItem>
                    <SelectItem value="ISC">ISC</SelectItem>
                    <SelectItem value="ICSE">ICSE</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={hostelFilter} onValueChange={setHostelFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Hostel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Hostels</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {hostelOptions.map((hostel) => (
                      <SelectItem key={hostel} value={hostel}>
                        {hostel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                {hasActiveFilters() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Clear Filters
                  </Button>
                )}
              </div>

              {/* Active filters summary */}
              {hasActiveFilters() && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Showing {filteredRegistrations.length} of {registrations.length} registrations</span>
                </div>
              )}
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
              <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={getHostelEligibleRegistrations().length > 0 && selectedForHostel.size === getHostelEligibleRegistrations().length}
                          onCheckedChange={toggleSelectAllHostel}
                          aria-label="Select all eligible for hostel"
                        />
                      </TableHead>
                      <TableHead>Application ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Hostel</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right sticky right-0 bg-background z-10 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {showGrouped ? (
                      <>
                        {/* Grouped registrations */}
                        {(() => {
                          const { groups, standalone } = getGroupedRegistrations(paginatedRegistrations);
                          return (
                            <>
                              {Array.from(groups.entries()).map(([groupId, members]) => (
                                <React.Fragment key={groupId}>
                                  {/* Group header row */}
                                  <TableRow className="bg-primary/5 border-l-4 border-l-primary">
                                    <TableCell className="py-2" />
                                    <TableCell colSpan={5} className="py-2">
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
                                    <TableCell colSpan={5} className="text-right py-2">
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
                                            disabled={isProcessing || !hasGroupApprovableRegistrations(members)}
                                            title={!hasGroupApprovableRegistrations(members) ? 'Payment must be submitted before approval' : undefined}
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
                                  {members.map((registration, index) => {
                                    const isHostelEligible = registration.registration_status === 'approved' && registration.stay_type === 'on-campus';
                                    return (
                                    <TableRow 
                                      key={registration.id}
                                      className={`${index === 0 ? 'bg-primary/10' : 'bg-muted/30'} border-l-4 ${index === 0 ? 'border-l-primary' : 'border-l-muted-foreground/30'}`}
                                    >
                                      <TableCell>
                                        {isHostelEligible && (
                                          <Checkbox
                                            checked={selectedForHostel.has(registration.id)}
                                            onCheckedChange={() => toggleHostelSelection(registration.id)}
                                            aria-label={`Select ${registration.name} for hostel assignment`}
                                          />
                                        )}
                                      </TableCell>
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
                                      <TableCell>{getStatusBadge(registration.registration_status, registration.accounts_verified)}</TableCell>
                                      <TableCell>{getPaymentBadge(registration.payment_status)}</TableCell>
                                      <TableCell>
                                        {registration.hostel_name ? (
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
                                      <TableCell className="text-right sticky right-0 bg-primary/10 z-10 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]">
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
                                  )})}
                                </React.Fragment>
                              ))}
                              {/* Standalone registrations */}
                              {standalone.map((registration) => {
                                const isHostelEligible = registration.registration_status === 'approved' && registration.stay_type === 'on-campus';
                                return (
                                <TableRow key={registration.id}>
                                  <TableCell>
                                    {isHostelEligible && (
                                      <Checkbox
                                        checked={selectedForHostel.has(registration.id)}
                                        onCheckedChange={() => toggleHostelSelection(registration.id)}
                                        aria-label={`Select ${registration.name} for hostel assignment`}
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {registration.application_id}
                                  </TableCell>
                                  <TableCell className="font-medium">{registration.name}</TableCell>
                                  <TableCell>{registration.email}</TableCell>
                                  <TableCell>{registration.year_of_passing}</TableCell>
                                  <TableCell>{getStatusBadge(registration.registration_status, registration.accounts_verified)}</TableCell>
                                  <TableCell>{getPaymentBadge(registration.payment_status)}</TableCell>
                                  <TableCell>
                                    {registration.hostel_name ? (
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
                                  <TableCell className="text-right sticky right-0 bg-background z-10 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]">
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
                              )})}
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      /* Flat view - original behavior */
                      paginatedRegistrations.map((registration) => {
                        const isHostelEligible = registration.registration_status === 'approved' && registration.stay_type === 'on-campus';
                        return (
                        <TableRow key={registration.id}>
                          <TableCell>
                            {isHostelEligible && (
                              <Checkbox
                                checked={selectedForHostel.has(registration.id)}
                                onCheckedChange={() => toggleHostelSelection(registration.id)}
                                aria-label={`Select ${registration.name} for hostel assignment`}
                              />
                            )}
                          </TableCell>
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
                          <TableCell>{getStatusBadge(registration.registration_status, registration.accounts_verified)}</TableCell>
                          <TableCell>{getPaymentBadge(registration.payment_status)}</TableCell>
                          <TableCell>
                            {registration.hostel_name ? (
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
                          <TableCell className="text-right sticky right-0 bg-background z-10 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]">
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
                      )})
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} registrations
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {getVisiblePageNumbers().map((page, index) => (
                        <PaginationItem key={index}>
                          {page === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
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
                  <label className="text-sm text-muted-foreground">Board</label>
                  <p className="font-medium">{selectedRegistration.board_type || 'N/A'}</p>
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
                {/* Hostel Assignment - Read-only display */}
                {selectedRegistration.stay_type === 'on-campus' && (
                  <div>
                    <label className="text-sm text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      Hostel Accommodation
                    </label>
                    <p className="font-medium mt-1">
                      {selectedRegistration.hostel_name || 'Not yet assigned'}
                    </p>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground">Payment Proof</label>
                  {selectedRegistration.payment_proof_url ? (
                    <div className="mt-2">
                      {(() => {
                        const proofUrl = toPublicPaymentProofUrl(selectedRegistration.payment_proof_url);
                        if (!proofUrl) return null;
                        return selectedRegistration.payment_proof_url.toLowerCase().endsWith('.pdf') ? (
                        <a 
                          href={proofUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-primary hover:underline"
                        >
                          <Eye className="h-4 w-4" />
                          View PDF Payment Proof
                        </a>
                      ) : (
                        <a 
                          href={proofUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <img 
                            src={proofUrl} 
                            alt="Payment proof" 
                            className="max-w-full max-h-64 rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </a>
                      );
                      })()}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <p className="font-medium text-muted-foreground">No proof uploaded</p>
                      {userRole === 'superadmin' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSyncingSingleProof}
                          onClick={() => {
                            const appId = selectedRegistration.parent_application_id || selectedRegistration.application_id;
                            syncSingleApplicationProof(appId);
                          }}
                        >
                          {isSyncingSingleProof ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Link2 className="h-3 w-3 mr-1" />
                          )}
                          Sync from Storage
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground">Payment Receipt (Accounts Admin)</label>
                  {selectedRegistration.payment_receipt_url ? (
                    <div className="mt-2">
                      <a 
                        href={toPublicPaymentReceiptUrl(selectedRegistration.payment_receipt_url) || '#'} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary hover:underline"
                      >
                        <Eye className="h-4 w-4" />
                        View Payment Receipt (PDF)
                      </a>
                    </div>
                  ) : (
                    <p className="font-medium text-muted-foreground">Not uploaded yet</p>
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

              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Registration Status</label>
                  <div className="mt-1">{getStatusBadge(selectedRegistration.registration_status, selectedRegistration.accounts_verified)}</div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Payment Status</label>
                  <div className="mt-1">{getPaymentBadge(selectedRegistration.payment_status)}</div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Accounts Verified</label>
                  <div className="mt-1">
                    {selectedRegistration.accounts_verified ? (
                      <Badge className="bg-secondary text-secondary-foreground">Verified</Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                </div>
                {/* Email Sent Status - Visible to superadmin for approved/rejected registrations */}
                {userRole === 'superadmin' && (selectedRegistration.registration_status === 'approved' || selectedRegistration.registration_status === 'rejected') && (
                  <div>
                    <label className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Email Notification
                    </label>
                    <div className="mt-1">
                      {selectedRegistration.approval_email_sent ? (
                        <Badge className="bg-green-600 text-white">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Sent
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Sent
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm text-muted-foreground">Registered On</label>
                  <p className="font-medium mt-1">
                    {format(new Date(selectedRegistration.created_at), 'dd MMM yyyy, hh:mm a')}
                  </p>
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
              <>
                <Button
                  variant="destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={isProcessing}
                  className="mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDetailOpen(false);
                    setIsEditDialogOpen(true);
                  }}
                  disabled={isProcessing}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </>
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
                  disabled={isProcessing || selectedRegistration?.payment_status !== 'submitted' || !selectedRegistration?.accounts_verified}
                  title={
                    selectedRegistration?.payment_status !== 'submitted' 
                      ? 'Payment must be submitted before approval' 
                      : !selectedRegistration?.accounts_verified 
                        ? 'Accounts Admin must verify payment before approval' 
                        : undefined
                  }
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
            {/* Superadmin can re-enable expired or rejected registrations */}
            {userRole === 'superadmin' && (selectedRegistration?.registration_status === 'expired' || selectedRegistration?.registration_status === 'rejected') && (
              <Button
                onClick={() => selectedRegistration && handleReEnableRegistration(selectedRegistration)}
                disabled={isProcessing}
                variant="outline"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Re-enable Registration
              </Button>
            )}
            {/* Superadmin and admin can resend approval email for approved registrations */}
            {(userRole === 'superadmin' || userRole === 'admin') && selectedRegistration?.registration_status === 'approved' && (
              <Button
                onClick={() => setIsResendEmailDialogOpen(true)}
                disabled={isProcessing || isResendingEmail}
                variant="outline"
              >
                <Mail className="h-4 w-4 mr-2" />
                Resend Approval Email
              </Button>
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

      {/* Resend Approval Email Confirmation Dialog */}
      <AlertDialog open={isResendEmailDialogOpen} onOpenChange={setIsResendEmailDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resend Approval Email</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to resend the approval email to{' '}
              <span className="font-semibold">{selectedRegistration?.email}</span>?
              {selectedRegistration?.payment_receipt_url && (
                <span className="block mt-2 text-sm">The payment receipt PDF will be attached to the email.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResendingEmail}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!selectedRegistration) return;
                setIsResendingEmail(true);
                try {
                  const emailSent = await sendNotificationEmail(selectedRegistration, 'approved');
                  if (emailSent) {
                    toast({
                      title: 'Email Sent',
                      description: `Approval email resent successfully to ${selectedRegistration.email}`,
                    });
                    // Log the activity
                    await logAdminActivity({
                      actionType: 'resend_approval_email',
                      targetRegistrationId: selectedRegistration.id,
                      targetApplicationId: selectedRegistration.application_id,
                      details: { email: selectedRegistration.email },
                    });
                  } else {
                    toast({
                      title: 'Email Failed',
                      description: 'Failed to resend approval email. Please try again.',
                      variant: 'destructive',
                    });
                  }
                } catch (error) {
                  console.error('Error resending email:', error);
                  toast({
                    title: 'Error',
                    description: 'An error occurred while resending the email.',
                    variant: 'destructive',
                  });
                } finally {
                  setIsResendingEmail(false);
                  setIsResendEmailDialogOpen(false);
                }
              }}
              disabled={isResendingEmail}
            >
              {isResendingEmail ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Resend Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Bulk Hostel Assignment Dialog */}
      <Dialog open={isBulkHostelDialogOpen} onOpenChange={(open) => {
        setIsBulkHostelDialogOpen(open);
        if (!open) {
          setBulkHostelSelection('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Bulk Hostel Assignment
            </DialogTitle>
            <DialogDescription>
              Assign the same hostel to {selectedForHostel.size} selected registration(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Hostel</label>
              <Select value={bulkHostelSelection} onValueChange={setBulkHostelSelection}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a hostel..." />
                </SelectTrigger>
                <SelectContent>
                  {hostelOptions.map((hostel) => (
                    <SelectItem key={hostel} value={hostel}>
                      {hostel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Selected registrations:</p>
              <ul className="list-disc list-inside space-y-1 max-h-40 overflow-y-auto">
                {filteredRegistrations
                  .filter(r => selectedForHostel.has(r.id))
                  .map(r => (
                    <li key={r.id}>{r.name} ({r.application_id})</li>
                  ))}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsBulkHostelDialogOpen(false);
                setBulkHostelSelection('');
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkHostelAssign}
              disabled={isProcessing || !bulkHostelSelection}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4 mr-2" />
              )}
              Assign to {selectedForHostel.size} Registration(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Registration Dialog (Superadmin only) */}
      <EditRegistrationDialog
        registration={selectedRegistration}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={fetchRegistrations}
      />
    </AdminLayout>
  );
};

export default AdminRegistrations;
