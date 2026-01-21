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
  Upload
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
  registration_fee: number;
  payment_status: string;
  payment_proof_url: string | null;
  payment_receipt_url: string | null;
  payment_reference: string | null;
  payment_date: string | null;
  accounts_verified: boolean;
  accounts_verified_at: string | null;
  created_at: string;
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
  
  const { toast } = useToast();
  const { user } = useAuth();

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
        .select('id, application_id, registration_fee, payment_status, payment_proof_url, payment_receipt_url, payment_reference, payment_date, accounts_verified, accounts_verified_at, created_at')
        .eq('payment_status', 'submitted')
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
        (r) => r.application_id.toLowerCase().includes(query)
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
        .from('payment-proofs')
        .upload(fileName, receiptFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
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
      }

      const { error } = await supabase
        .from('registrations')
        .update({
          accounts_verified: true,
          accounts_verified_at: new Date().toISOString(),
          accounts_verified_by: user?.id,
          payment_receipt_url: receiptUrl,
        })
        .eq('id', registration.id);

      if (error) throw error;

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
                  placeholder="Search by application ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                        <TableHead>Payment Date</TableHead>
                        <TableHead>Verification</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRegistrations.map((registration) => (
                        <TableRow key={registration.id}>
                          <TableCell className="font-mono text-sm font-medium">
                            {registration.application_id}
                          </TableCell>
                          <TableCell>₹{registration.registration_fee}</TableCell>
                          <TableCell>
                            {registration.payment_date 
                              ? format(new Date(registration.payment_date), 'MMM d, yyyy')
                              : '-'}
                          </TableCell>
                          <TableCell>{getVerificationBadge(registration.accounts_verified)}</TableCell>
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
                    {selectedRegistration.payment_proof_url.toLowerCase().endsWith('.pdf') ? (
                      <a 
                        href={selectedRegistration.payment_proof_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary hover:underline"
                      >
                        <FileCheck className="h-4 w-4" />
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
                          className="max-w-full max-h-80 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      </a>
                    )}
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
                        href={selectedRegistration.payment_receipt_url} 
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
                  {isUploadingReceipt ? 'Uploading...' : 'Verify Payment'}
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
