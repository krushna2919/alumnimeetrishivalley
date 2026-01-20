import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, X, User, CheckCircle, AlertCircle, IndianRupee, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AttendeeData, RegistrantData, calculateFee } from "./types";

interface Applicant {
  id: string;
  name: string;
  stayType: "on-campus" | "outside";
  fee: number;
  isPrimary: boolean;
}

interface BulkPaymentProofUploadProps {
  registrant: RegistrantData;
  additionalAttendees: AttendeeData[];
  paymentProofs: Map<string, File>;
  onPaymentProofsChange: (proofs: Map<string, File>) => void;
}

const BulkPaymentProofUpload = ({
  registrant,
  additionalAttendees,
  paymentProofs,
  onPaymentProofsChange,
}: BulkPaymentProofUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Build list of all applicants for display only
  const applicants: Applicant[] = [
    {
      id: "primary",
      name: registrant.name || "Primary Registrant",
      stayType: registrant.stayType,
      fee: calculateFee(registrant.stayType),
      isPrimary: true,
    },
    ...additionalAttendees.map((attendee, index) => ({
      id: `attendee-${index}`,
      name: attendee.name || `Attendee ${index + 1}`,
      stayType: attendee.stayType,
      fee: calculateFee(attendee.stayType),
      isPrimary: false,
    })),
  ];

  const totalFee = applicants.reduce((sum, a) => sum + a.fee, 0);
  const hasMultipleApplicants = applicants.length > 1;
  const hasFile = paymentProofs.has("combined");

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, WebP, or PDF file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    // Update payment proofs with "combined" key
    const newProofs = new Map<string, File>();
    newProofs.set("combined", file);
    onPaymentProofsChange(newProofs);

    // Create preview for images
    if (file.type.startsWith("image/")) {
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(file));
    } else {
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
    }

    toast.success("Payment proof attached successfully");
  };

  const removeFile = () => {
    onPaymentProofsChange(new Map());
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFee = (fee: number) => `₹${fee.toLocaleString("en-IN")}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          <h4 className="font-semibold text-foreground">Payment Proof Upload</h4>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`px-2 py-1 rounded-full ${
              hasFile
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
            }`}
          >
            {hasFile ? "Uploaded" : "Pending"}
          </span>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {hasMultipleApplicants
              ? `Please upload a single payment proof covering the total amount for all ${applicants.length} applicants.`
              : "Please upload your payment proof before submitting."
            }
          </p>
        </div>
      </div>

      {/* Applicant Summary - Only show for multiple applicants */}
      {hasMultipleApplicants && (
        <div className="bg-muted/30 rounded-lg p-3 border border-border">
          <p className="text-sm font-medium text-foreground mb-2">Applicants covered by this payment:</p>
          <div className="flex flex-wrap gap-2">
            {applicants.map((applicant) => (
              <span
                key={applicant.id}
                className="inline-flex items-center gap-1 text-xs bg-background px-2 py-1 rounded-full border border-border"
              >
                <User className="w-3 h-3" />
                {applicant.name}
                {applicant.isPrimary && (
                  <span className="text-primary">(Primary)</span>
                )}
                <span className="text-muted-foreground">- {formatFee(applicant.fee)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Single Upload Area */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-xl border transition-colors ${
          hasFile
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
            : "bg-background border-border"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <span className="font-medium text-foreground">
              {hasMultipleApplicants ? "Combined Payment Proof" : "Payment Proof"}
            </span>
          </div>

          {hasFile ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/40 rounded-lg">
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-8 h-8 object-cover rounded border border-green-300"
                  />
                ) : (
                  <FileText className="w-4 h-4 text-green-600" />
                )}
                <span className="text-xs text-green-700 dark:text-green-300 max-w-[100px] truncate">
                  {paymentProofs.get("combined")?.name}
                </span>
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeFile}
                className="text-destructive hover:text-destructive h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload Proof
              </Button>
            </>
          )}
        </div>
      </motion.div>

      {/* Total Summary */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <span className="text-muted-foreground">Total Amount:</span>
        <div className="flex items-center gap-1 text-xl font-bold text-primary">
          <IndianRupee className="w-5 h-5" />
          {totalFee.toLocaleString("en-IN")}
        </div>
      </div>

      {/* Validation Message */}
      {!hasFile && (
        <div className="bg-destructive/10 rounded-lg p-3 border border-destructive/30">
          <p className="text-sm text-destructive">
            Please upload the payment proof before submitting the registration.
          </p>
        </div>
      )}
    </div>
  );
};

export default BulkPaymentProofUpload;
