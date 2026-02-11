import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, Upload, FileText, X, CheckCircle, ExternalLink } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Registration = Tables<'registrations'>;

interface EditRegistrationDialogProps {
  registration: Registration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// T-shirt sizes must match the registration form exactly
const TSHIRT_SIZES = [
  'S (Chest: 36")',
  'M (Chest: 38-40")',
  'L (Chest: 42")',
  'XL (Chest: 44")'
] as const;
const GENDER_OPTIONS = ['M', 'F'] as const;
const STAY_TYPES = ['on-campus', 'outside'] as const;
const BOARD_TYPES = ['ISC', 'ICSE', 'Other'] as const;

const EditRegistrationDialog = ({
  registration,
  open,
  onOpenChange,
  onSuccess,
}: EditRegistrationDialogProps) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [uploadedProof, setUploadedProof] = useState<{ name: string; url: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    occupation: '',
    year_of_passing: 0,
    board_type: '',
    gender: '',
    tshirt_size: '',
    stay_type: '',
    registration_fee: 0,
    address_line1: '',
    address_line2: '',
    city: '',
    district: '',
    state: '',
    postal_code: '',
    country: '',
  });

  // Reset form when registration changes
  useEffect(() => {
    if (registration) {
      setFormData({
        name: registration.name || '',
        email: registration.email || '',
        phone: registration.phone || '',
        occupation: registration.occupation || '',
        year_of_passing: registration.year_of_passing || 0,
        board_type: registration.board_type || 'ISC',
        gender: registration.gender || '',
        tshirt_size: registration.tshirt_size || '',
        stay_type: registration.stay_type || '',
        registration_fee: registration.registration_fee || 0,
        address_line1: registration.address_line1 || '',
        address_line2: registration.address_line2 || '',
        city: registration.city || '',
        district: registration.district || '',
        state: registration.state || '',
        postal_code: registration.postal_code || '',
        country: registration.country || 'India',
      });
      setUploadedProof(null);
    }
  }, [registration]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleProofFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !registration) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Please upload a JPG, PNG, WebP, or PDF file', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'File size must be less than 5MB', variant: 'destructive' });
      return;
    }

    setIsUploadingProof(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${registration.application_id}-${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (error) {
        console.error('Upload error:', error);
        toast({ title: 'Upload failed', description: 'Failed to upload payment proof', variant: 'destructive' });
        return;
      }

      const { data: urlData } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(data.path);

      setUploadedProof({ name: file.name, url: urlData.publicUrl });
      toast({ title: 'Payment proof uploaded', description: file.name });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Upload failed', description: 'Failed to upload payment proof', variant: 'destructive' });
    } finally {
      setIsUploadingProof(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!registration) return;

    setIsProcessing(true);
    try {
      // Build update payload
      const updatePayload: Record<string, unknown> = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        occupation: formData.occupation.trim(),
        year_of_passing: formData.year_of_passing,
        board_type: formData.board_type,
        gender: formData.gender,
        tshirt_size: formData.tshirt_size,
        stay_type: formData.stay_type,
        registration_fee: formData.registration_fee,
        address_line1: formData.address_line1.trim(),
        address_line2: formData.address_line2?.trim() || null,
        city: formData.city.trim(),
        district: formData.district.trim(),
        state: formData.state.trim(),
        postal_code: formData.postal_code.trim(),
        country: formData.country.trim(),
        updated_at: new Date().toISOString(),
      };

      // If a new proof was uploaded, link it and set payment status to submitted
      if (uploadedProof) {
        updatePayload.payment_proof_url = uploadedProof.url;
        updatePayload.payment_status = 'submitted';
      }

      // If edit mode is enabled, mark as ready for final approval after admin saves changes
      // Note: accounts_verified should already be true at this point (set by accounts admin)
      if (registration.edit_mode_enabled) {
        updatePayload.pending_admin_approval = true;
      }

      const { error } = await supabase
        .from('registrations')
        .update(updatePayload)
        .eq('id', registration.id);

      if (error) throw error;

      // If this is a group parent and proof was uploaded, also link to child registrations
      if (uploadedProof && !registration.parent_application_id) {
        const { data: children } = await supabase
          .from('registrations')
          .select('application_id')
          .eq('parent_application_id', registration.application_id);

        if (children && children.length > 0) {
          for (const child of children) {
            await supabase
              .from('registrations')
              .update({
                payment_proof_url: uploadedProof.url,
                payment_status: 'submitted',
                updated_at: new Date().toISOString(),
              })
              .eq('application_id', child.application_id);
          }
        }
      }

      toast({
        title: 'Registration Updated',
        description: `Successfully updated registration for ${formData.name}.${uploadedProof ? ' Payment proof linked.' : ''}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating registration:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update registration details.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!registration) return null;

  const hasExistingProof = !!registration.payment_proof_url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Edit Registration</DialogTitle>
          <DialogDescription>
            Editing: {registration.application_id}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {/* Payment Proof Section */}
          <div className="col-span-full border rounded-lg p-4 bg-muted/30">
            <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4" />
              Payment Proof
            </h4>

            {hasExistingProof && !uploadedProof && (
              <div className="flex items-center gap-2 mb-3 text-sm">
                <CheckCircle className="h-4 w-4 text-secondary-foreground" />
                <span className="text-muted-foreground">Existing proof on file</span>
                <a
                  href={registration.payment_proof_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {!hasExistingProof && !uploadedProof && (
              <p className="text-sm text-destructive mb-3">
                ⚠ No payment proof on file for this registration.
              </p>
            )}

            {uploadedProof ? (
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg border border-secondary">
                <CheckCircle className="h-5 w-5 text-secondary-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{uploadedProof.name}</p>
                  <a
                    href={uploadedProof.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    View uploaded file
                  </a>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadedProof(null)}
                  className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleProofFileSelect}
                  className="hidden"
                  disabled={isUploadingProof}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingProof}
                  className="gap-2"
                >
                  {isUploadingProof ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      {hasExistingProof ? 'Replace Payment Proof' : 'Upload Payment Proof'}
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG, WebP, or PDF (max 5MB)
                </p>
              </div>
            )}
          </div>

          {/* Personal Information */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="occupation">Occupation</Label>
            <Input
              id="occupation"
              value={formData.occupation}
              onChange={(e) => handleInputChange('occupation', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="year_of_passing">Year of Passing</Label>
            <Input
              id="year_of_passing"
              type="number"
              value={formData.year_of_passing}
              onChange={(e) => handleInputChange('year_of_passing', parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="board_type">Board Type</Label>
            <Select
              value={formData.board_type}
              onValueChange={(value) => handleInputChange('board_type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select board" />
              </SelectTrigger>
              <SelectContent>
                {BOARD_TYPES.map((board) => (
                  <SelectItem key={board} value={board}>
                    {board}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select
              value={formData.gender}
              onValueChange={(value) => handleInputChange('gender', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((gender) => (
                  <SelectItem key={gender} value={gender}>
                    {gender === 'M' ? 'Male' : 'Female'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tshirt_size">T-Shirt Size</Label>
            <Select
              value={formData.tshirt_size}
              onValueChange={(value) => handleInputChange('tshirt_size', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {TSHIRT_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stay_type">Stay Type</Label>
            <Select
              value={formData.stay_type}
              onValueChange={(value) => handleInputChange('stay_type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select stay type" />
              </SelectTrigger>
              <SelectContent>
                {STAY_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {type === 'on-campus' ? 'On Campus' : 'Outside'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="registration_fee">Registration Fee (₹)</Label>
            <Input
              id="registration_fee"
              type="number"
              value={formData.registration_fee}
              onChange={(e) => handleInputChange('registration_fee', parseInt(e.target.value) || 0)}
            />
          </div>

          {/* Address Section */}
          <div className="col-span-full border-t pt-4 mt-2">
            <h4 className="font-medium text-sm text-muted-foreground mb-3">Address Details</h4>
          </div>

          <div className="space-y-2 col-span-full">
            <Label htmlFor="address_line1">Address Line 1</Label>
            <Input
              id="address_line1"
              value={formData.address_line1}
              onChange={(e) => handleInputChange('address_line1', e.target.value)}
            />
          </div>

          <div className="space-y-2 col-span-full">
            <Label htmlFor="address_line2">Address Line 2</Label>
            <Input
              id="address_line2"
              value={formData.address_line2 || ''}
              onChange={(e) => handleInputChange('address_line2', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="district">District</Label>
            <Input
              id="district"
              value={formData.district}
              onChange={(e) => handleInputChange('district', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={formData.state}
              onChange={(e) => handleInputChange('state', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postal_code">Postal Code</Label>
            <Input
              id="postal_code"
              value={formData.postal_code}
              onChange={(e) => handleInputChange('postal_code', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditRegistrationDialog;
