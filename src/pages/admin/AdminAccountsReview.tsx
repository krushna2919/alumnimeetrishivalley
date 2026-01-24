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
  ChevronLeft,
  FileCheck,
  Receipt,
  Upload,
  Users,
  ChevronRight
} from 'lucide-react';
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

interface AccountsRegistration {
  id: string;
  application_id: string;
  name: string;
  registration_fee: number;
  payment_status: string;
  payment_proof_url: string | null;
  payment_receipt_url: string | null;
  payment_reference: string | null;
  payment_date: string | null;
  accounts_verified: boolean;
  accounts_verified_at: string | null;
  created_at: string;
  parent_application_id: string | null;
}

const AdminAccountsReview = () => {
  const [registrations, setRegistrations] = useState<AccountsRegistration[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<AccountsRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [verificationFilter, setVerificationFilter] = useState<string>('pending');
  const [selectedRegistration, setSelectedRegistration] = useState<AccountsRegistration | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Group view state
  const [showGrouped, setShowGrouped] = useState(true);
  
  const { toast } = useToast();
  const { user } = useAuth();

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

  const resolvePaymentProofUrlFromStorage = async (applicationId: string): Promise<string | null> => {
    // New uploads are named like: `${applicationId}-<timestamp>.<ext>`
    // Bulk uploads are named like: `combined-${applicationId}-<timestamp>.<ext>`
    try {
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .list('', { limit: 50, search: applicationId });

      if (error) throw error;

      const matches = (data ?? [])
        .filter((f) =>
          f.name.startsWith(`${applicationId}-`) ||
          f.name.startsWith(`combined-${applicationId}-`)
        )
        .sort((a, b) => {
          const aTime = new Date((a.updated_at || a.created_at) as string).getTime();
          const bTime = new Date((b.updated_at || b.created_at) as string).getTime();
          return bTime - aTime;
        });

      const latest = matches[0];
      if (!latest) return null;

      const { data: publicData } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(latest.name);

      return publicData.publicUrl ?? null;
    } catch (err) {
      console.error('Failed to resolve payment proof from storage:', err);
      return null;
    }
  };

  const backfillMissingPaymentProofUrls = async (rows: AccountsRegistration[]) => {
    const missing = rows.filter((r) => r.payment_status === 'submitted' && !r.payment_proof_url);
    if (missing.length === 0) return;

    // Build a map of parent_application_id -> payment_proof_url for parents that have proofs
    const parentProofMap: Record<string, string> = {};
    rows.forEach((r) => {
      if (!r.parent_application_id && r.payment_proof_url) {
        parentProofMap[r.application_id] = r.payment_proof_url;
      }
    });

    // Keep this light: resolve only a handful per refresh to avoid hammering storage.
    const toResolve = missing.slice(0, 10);

    let linkedCount = 0;
    await Promise.allSettled(
      toResolve.map(async (r) => {
        let resolvedUrl: string | null = null;

        // First check if parent has a proof we can inherit
        if (r.parent_application_id && parentProofMap[r.parent_application_id]) {
          resolvedUrl = parentProofMap[r.parent_application_id];
        } else {
          // Fall back to searching storage
          resolvedUrl = await resolvePaymentProofUrlFromStorage(r.application_id);
        }

        if (!resolvedUrl) return;

        const { error } = await supabase
          .from('registrations')
          .update({ payment_proof_url: resolvedUrl, updated_at: new Date().toISOString() })
          .eq('id', r.id);

        if (error) {
          console.error('Failed to backfill payment_proof_url:', error);
        } else {
          linkedCount++;
        }
      })
    );

    if (linkedCount > 0) {
      console.log(`Auto-linked ${linkedCount} missing payment proofs`);
    }
  };

  useEffect(() => {
    fetchRegistrations();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('accounts-registrations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'registrations'
        },
        () => {
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
    setCurrentPage(1);
  }, [registrations, searchQuery, verificationFilter]);

  const fetchRegistrations = async () => {
    setIsLoading(true);
    try {
      // Accounts admin only sees payment-related fields
      const { data, error } = await supabase
        .from('registrations')
        .select('id, application_id, name, registration_fee, payment_status, payment_proof_url, payment_receipt_url, payment_reference, payment_date, accounts_verified, accounts_verified_at, created_at, parent_application_id')
        .eq('payment_status', 'submitted')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = (data || []) as AccountsRegistration[];
      setRegistrations(rows);

      // If some rows show "submitted" but proof URL is missing (upload succeeded but DB link failed),
      // auto-resolve by looking up the latest matching file in storage and writing it back.
      // This avoids needing any backend script runs.
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
        (r) => r.application_id.toLowerCase().includes(query) ||
               r.name.toLowerCase().includes(query)
      );
    }

    if (verificationFilter === 'pending') {
      filtered = filtered.filter((r) => !r.accounts_verified);
    } else if (verificationFilter === 'verified') {
      filtered = filtered.filter((r) => r.accounts_verified);
    }

    setFilteredRegistrations(filtered);
  };

  const handleReceiptSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - PDF only
    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid File',
        description: 'Please upload a PDF file only',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'File size must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setReceiptFile(file);
    setReceiptPreview(null); // PDFs don't have preview
  };

  const uploadReceipt = async (registration: AccountsRegistration): Promise<string | null> => {
    if (!receiptFile) return null;

    setIsUploadingReceipt(true);
    try {
      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `receipt-${registration.application_id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(fileName, receiptFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-receipts')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      throw error;
    } finally {
      setIsUploadingReceipt(false);
    }
  };


  const handleVerifyPayment = async (registration: AccountsRegistration) => {
    if (!receiptFile && !registration.payment_receipt_url) {
      toast({
        title: 'Receipt Required',
        description: 'Please upload a payment receipt before verifying',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      let receiptUrl = registration.payment_receipt_url;

      // Upload receipt if a new file was selected
      if (receiptFile) {
        receiptUrl = await uploadReceipt(registration);
        
        // Log receipt upload activity
        await logAdminActivity({
          actionType: 'receipt_upload',
          targetRegistrationId: registration.id,
          targetApplicationId: registration.application_id,
          details: { receiptFileName: receiptFile.name }
        });
      }

      const verifiedAt = new Date().toISOString();

      const { error } = await supabase
        .from('registrations')
        .update({
          accounts_verified: true,
          accounts_verified_at: verifiedAt,
          accounts_verified_by: user?.id,
          payment_receipt_url: receiptUrl,
        })
        .eq('id', registration.id);

      if (error) throw error;

      // Log account approval activity
      await logAdminActivity({
        actionType: 'account_approval',
        targetRegistrationId: registration.id,
        targetApplicationId: registration.application_id,
        details: { registrationFee: registration.registration_fee }
      });

      toast({
        title: 'Payment Verified',
        description: `Payment for ${registration.application_id} has been verified with receipt. Admin can now approve.`,
      });

      // Clear receipt state
      setReceiptFile(null);
      setReceiptPreview(null);
      
      fetchRegistrations();
      setIsDetailOpen(false);
    } catch (error) {
      console.error('Error verifying payment:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify payment',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedRegistration || !rejectionReason.trim()) return;

    setIsProcessing(true);
    try {
      // Reject the payment by setting payment_status back to pending and clearing proof
      const { error } = await supabase
        .from('registrations')
        .update({
          payment_status: 'pending',
          payment_proof_url: null,
          payment_reference: null,
        })
        .eq('id', selectedRegistration.id);

      if (error) throw error;

      // Log account rejection activity
      await logAdminActivity({
        actionType: 'account_rejection',
        targetRegistrationId: selectedRegistration.id,
        targetApplicationId: selectedRegistration.application_id,
        details: { rejectionReason }
      });

      toast({
        title: 'Payment Rejected',
        description: `Payment proof for ${selectedRegistration.application_id} has been rejected. They will need to resubmit.`,
      });

      fetchRegistrations();
      setIsRejectDialogOpen(false);
      setIsDetailOpen(false);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting payment:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject payment',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getVerificationBadge = (verified: boolean) => {
    if (verified) {
      return <Badge className="bg-secondary text-secondary-foreground">Verified</Badge>;
    }
    return <Badge variant="outline" className="border-accent text-accent">Pending Review</Badge>;
  };

  // Group registrations by parent_application_id
  const getGroupedRegistrations = (registrationsToGroup: AccountsRegistration[]) => {
    const groups: Map<string, AccountsRegistration[]> = new Map();
    const standalone: AccountsRegistration[] = [];

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
            <h1 className="font-serif text-3xl font-bold text-foreground">Payment Verification</h1>
            <p className="text-muted-foreground mt-1">
              Review and verify payment proofs before admin approval
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
                  placeholder="Search by application ID or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="pl-10"
                />
              </div>
              <Select value={verificationFilter} onValueChange={setVerificationFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Submissions</SelectItem>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
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
                No payment submissions to review
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Application ID</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Applicant Name</TableHead>
                        <TableHead>Verification</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
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
                                      <TableCell colSpan={3} className="py-2">
                                        <div className="flex items-center gap-2">
                                          <Users className="h-4 w-4 text-primary" />
                                          <span className="font-semibold text-primary">
                                            Group: {groupId}
                                          </span>
                                          <Badge variant="secondary" className="ml-2">
                                            {members.length} member{members.length > 1 ? 's' : ''}
                                          </Badge>
                                          <Badge variant="outline" className="ml-1">
                                            ₹{members.reduce((sum, m) => sum + m.registration_fee, 0)}
                                          </Badge>
                                        </div>
                                      </TableCell>
                                      <TableCell colSpan={2} className="text-right py-2">
                                        {members.some(m => !m.accounts_verified) && (
                                          <Badge variant="outline" className="border-accent text-accent">
                                            {members.filter(m => !m.accounts_verified).length} pending
                                          </Badge>
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
                                        <TableCell>₹{registration.registration_fee}</TableCell>
                                        <TableCell>{registration.name}</TableCell>
                                        <TableCell>{getVerificationBadge(registration.accounts_verified)}</TableCell>
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
                                    <TableCell className="font-mono text-sm font-medium">
                                      {registration.application_id}
                                    </TableCell>
                                    <TableCell>₹{registration.registration_fee}</TableCell>
                                    <TableCell>{registration.name}</TableCell>
                                    <TableCell>{getVerificationBadge(registration.accounts_verified)}</TableCell>
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
                        // Flat view
                        paginatedRegistrations.map((registration) => (
                          <TableRow key={registration.id}>
                            <TableCell className="font-mono text-sm font-medium">
                              {registration.application_id}
                            </TableCell>
                            <TableCell>₹{registration.registration_fee}</TableCell>
                            <TableCell>{registration.name}</TableCell>
                            <TableCell>{getVerificationBadge(registration.accounts_verified)}</TableCell>
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                    <p className="text-sm text-muted-foreground">
                      Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} submissions
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

      {/* Payment Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Payment Verification
            </DialogTitle>
            <DialogDescription>
              Application ID: {selectedRegistration?.application_id}
            </DialogDescription>
          </DialogHeader>

          {selectedRegistration && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Registration Fee</label>
                  <p className="font-medium text-lg">₹{selectedRegistration.registration_fee}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Payment Date</label>
                  <p className="font-medium">
                    {selectedRegistration.payment_date 
                      ? format(new Date(selectedRegistration.payment_date), 'MMM d, yyyy')
                      : 'Not specified'}
                  </p>
                </div>
                {selectedRegistration.payment_reference && (
                  <div className="col-span-2">
                    <label className="text-sm text-muted-foreground">Payment Reference / UTR</label>
                    <p className="font-mono text-sm bg-muted p-2 rounded">
                      {selectedRegistration.payment_reference}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground font-medium">Payment Proof</label>
                {selectedRegistration.payment_proof_url ? (
                  <div className="mt-2 border border-border rounded-lg p-4 bg-muted/30">
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
                        <FileCheck className="h-4 w-4" />
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
                          className="max-w-full max-h-80 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      </a>
                    );
                    })()}
                  </div>
                ) : (
                  <p className="font-medium text-muted-foreground mt-2">No proof uploaded</p>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Verification Status</label>
                <div className="mt-1">{getVerificationBadge(selectedRegistration.accounts_verified)}</div>
              </div>

              {/* Receipt Upload Section - Only show if not already verified */}
              {!selectedRegistration.accounts_verified && (
                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-foreground">
                    Upload Payment Receipt PDF (Required)
                  </label>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">
                    Upload a PDF receipt that will be attached to the approval email
                  </p>
                  
                  {/* Show existing receipt if any */}
                  {selectedRegistration.payment_receipt_url && !receiptFile && (
                    <div className="mb-3 p-3 bg-secondary/30 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Current Receipt:</p>
                      <a 
                        href={toPublicPaymentReceiptUrl(selectedRegistration.payment_receipt_url) || '#'} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                      >
                        <FileCheck className="h-4 w-4" />
                        View PDF Receipt
                      </a>
                    </div>
                  )}

                  {/* Receipt preview */}
                  {receiptFile && (
                    <div className="mb-3 p-3 bg-primary/10 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileCheck className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">{receiptFile.name}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setReceiptFile(null);
                            setReceiptPreview(null);
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Upload button */}
                  {!receiptFile && (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleReceiptSelect}
                        className="hidden"
                      />
                      <div className="border-2 border-dashed border-border hover:border-primary rounded-lg p-4 text-center transition-colors">
                        <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Click to upload PDF receipt
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PDF only (max 5MB)
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {selectedRegistration && !selectedRegistration.accounts_verified && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsRejectDialogOpen(true)}
                  disabled={isProcessing}
                  className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Proof
                </Button>
                <Button
                  onClick={() => selectedRegistration && handleVerifyPayment(selectedRegistration)}
                  disabled={isProcessing || isUploadingReceipt || (!receiptFile && !selectedRegistration?.payment_receipt_url)}
                >
                  {isProcessing || isUploadingReceipt ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {isUploadingReceipt ? 'Uploading...' : 'Approve Payment'}
                </Button>
              </>
            )}
            {selectedRegistration?.accounts_verified && (
              <Badge className="bg-secondary text-secondary-foreground">
                Already Verified
              </Badge>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Payment Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Reject Payment Proof</DialogTitle>
            <DialogDescription>
              The payment proof will be cleared and the applicant will need to resubmit.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter reason for rejection (e.g., unclear image, amount mismatch)..."
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
              onClick={handleRejectPayment}
              disabled={isProcessing || !rejectionReason.trim()}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminAccountsReview;
