import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, FileText, X, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditModePaymentProofUploadProps {
  applicationId: string;
  onUploadSuccess: (url: string) => void;
}

const EditModePaymentProofUpload: React.FC<EditModePaymentProofUploadProps> = ({
  applicationId,
  onUploadSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a JPG, PNG, WebP, or PDF file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename with edit-mode prefix
      const timestamp = Date.now();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `edit-mode-${applicationId}-${timestamp}.${ext}`;

      // Upload to payment-proofs bucket
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        toast.error('Failed to upload payment proof');
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(data.path);

      const publicUrl = urlData.publicUrl;

      setUploadedFile({ name: file.name, url: publicUrl });
      onUploadSuccess(publicUrl);
      toast.success('Payment proof uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload payment proof');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearUpload = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Upload className="h-4 w-4 text-accent-foreground" />
            Upload New Payment Proof
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Upload updated payment proof during edit mode
          </p>
        </div>
      </div>

      {uploadedFile ? (
        <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg border border-secondary">
          <CheckCircle className="h-5 w-5 text-secondary-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {uploadedFile.name}
            </p>
            <a
              href={uploadedFile.url}
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
            onClick={clearUpload}
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
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full justify-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Choose File
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Accepts JPG, PNG, WebP, or PDF (max 5MB)
          </p>
        </div>
      )}
    </div>
  );
};

export default EditModePaymentProofUpload;
