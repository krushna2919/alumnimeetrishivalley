import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, X, User, CheckCircle, AlertCircle, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AttendeeData, RegistrantData, calculateFee } from "./types";

interface Applicant {
  id: string; // Temporary ID for tracking (will be replaced with real applicationId after submit)
  name: string;
  stayType: "on-campus" | "outside";
  fee: number;
  isPrimary: boolean;
}

interface PaymentProofFile {
  file: File;
  previewUrl: string | null;
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
  const fileInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());

  // Build list of all applicants
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
  const uploadedCount = paymentProofs.size;
  const allUploaded = uploadedCount === applicants.length;

  const handleFileSelect = (applicantId: string, event: React.ChangeEvent<HTMLInputElement>) => {
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

    // Update payment proofs
    const newProofs = new Map(paymentProofs);
    newProofs.set(applicantId, file);
    onPaymentProofsChange(newProofs);

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviews((prev) => {
        const newPreviews = new Map(prev);
        // Revoke old preview URL if exists
        const oldUrl = prev.get(applicantId);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        newPreviews.set(applicantId, url);
        return newPreviews;
      });
    } else {
      setPreviews((prev) => {
        const newPreviews = new Map(prev);
        const oldUrl = prev.get(applicantId);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        newPreviews.delete(applicantId);
        return newPreviews;
      });
    }

    toast.success(`Payment proof attached for ${applicants.find((a) => a.id === applicantId)?.name}`);
  };

  const removeFile = (applicantId: string) => {
    const newProofs = new Map(paymentProofs);
    newProofs.delete(applicantId);
    onPaymentProofsChange(newProofs);

    // Revoke preview URL
    const previewUrl = previews.get(applicantId);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviews((prev) => {
        const newPreviews = new Map(prev);
        newPreviews.delete(applicantId);
        return newPreviews;
      });
    }

    // Reset file input
    const inputRef = fileInputRefs.current.get(applicantId);
    if (inputRef) inputRef.value = "";
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
              allUploaded
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
            }`}
          >
            {uploadedCount}/{applicants.length} uploaded
          </span>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Please upload a separate payment proof for each applicant. All proofs must be uploaded before submitting.
          </p>
        </div>
      </div>

      {/* Applicant List */}
      <div className="space-y-3">
        <AnimatePresence>
          {applicants.map((applicant) => {
            const hasFile = paymentProofs.has(applicant.id);
            const file = paymentProofs.get(applicant.id);
            const previewUrl = previews.get(applicant.id);

            return (
              <motion.div
                key={applicant.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-xl border transition-colors ${
                  hasFile
                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
                    : "bg-background border-border"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Applicant Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <User className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground truncate">{applicant.name}</span>
                      {applicant.isPrimary && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Primary</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span>{applicant.stayType === "on-campus" ? "On Campus" : "Outside"}</span>
                      <span className="font-medium text-foreground">{formatFee(applicant.fee)}</span>
                    </div>
                  </div>

                  {/* Upload Area */}
                  <div className="flex items-center gap-2">
                    {hasFile ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/40 rounded-lg">
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt="Preview"
                              className="w-8 h-8 object-cover rounded border border-green-300"
                            />
                          ) : (
                            <FileText className="w-4 h-4 text-green-600" />
                          )}
                          <span className="text-xs text-green-700 dark:text-green-300 max-w-[100px] truncate">
                            {file?.name}
                          </span>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(applicant.id)}
                          className="text-destructive hover:text-destructive h-8 w-8 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <input
                          ref={(el) => fileInputRefs.current.set(applicant.id, el)}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={(e) => handleFileSelect(applicant.id, e)}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRefs.current.get(applicant.id)?.click()}
                          className="gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          Upload
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Total Summary */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <span className="text-muted-foreground">Total Amount:</span>
        <div className="flex items-center gap-1 text-xl font-bold text-primary">
          <IndianRupee className="w-5 h-5" />
          {totalFee.toLocaleString("en-IN")}
        </div>
      </div>

      {/* Validation Message */}
      {!allUploaded && (
        <div className="bg-destructive/10 rounded-lg p-3 border border-destructive/30">
          <p className="text-sm text-destructive">
            Please upload payment proof for all {applicants.length} applicant(s) before submitting the registration.
          </p>
        </div>
      )}
    </div>
  );
};

export default BulkPaymentProofUpload;
