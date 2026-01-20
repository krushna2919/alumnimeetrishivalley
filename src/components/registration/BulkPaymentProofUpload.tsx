import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, X, User, CheckCircle, AlertCircle, IndianRupee, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AttendeeData, RegistrantData, calculateFee } from "./types";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

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
  uploadMode: "single" | "individual";
  onUploadModeChange: (mode: "single" | "individual") => void;
}

const BulkPaymentProofUpload = ({
  registrant,
  additionalAttendees,
  paymentProofs,
  onPaymentProofsChange,
  uploadMode,
  onUploadModeChange,
}: BulkPaymentProofUploadProps) => {
  const fileInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const singleFileInputRef = useRef<HTMLInputElement | null>(null);
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
  const hasMultipleApplicants = applicants.length > 1;

  // Calculate uploaded status based on mode
  const isComplete = uploadMode === "single" 
    ? paymentProofs.has("combined") 
    : applicants.every(a => paymentProofs.has(a.id));

  const uploadedCount = uploadMode === "single"
    ? (paymentProofs.has("combined") ? applicants.length : 0)
    : Array.from(paymentProofs.keys()).filter(key => key !== "combined").length;

  const handleModeChange = (newMode: "single" | "individual") => {
    // Clear existing proofs when switching modes
    onPaymentProofsChange(new Map());
    setPreviews(new Map());
    onUploadModeChange(newMode);
  };

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

    const displayName = applicantId === "combined" 
      ? "all applicants" 
      : applicants.find((a) => a.id === applicantId)?.name;
    toast.success(`Payment proof attached for ${displayName}`);
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
    if (applicantId === "combined") {
      if (singleFileInputRef.current) singleFileInputRef.current.value = "";
    } else {
      const inputRef = fileInputRefs.current.get(applicantId);
      if (inputRef) inputRef.value = "";
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
              isComplete
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
            }`}
          >
            {uploadedCount}/{applicants.length} uploaded
          </span>
        </div>
      </div>

      {/* Upload Mode Selection - Only show for multiple applicants */}
      {hasMultipleApplicants && (
        <div className="bg-muted/50 rounded-lg p-4 border border-border">
          <p className="text-sm font-medium text-foreground mb-3">How would you like to upload payment proof?</p>
          <RadioGroup
            value={uploadMode}
            onValueChange={(value) => handleModeChange(value as "single" | "individual")}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="single" id="single-proof" />
              <Label htmlFor="single-proof" className="cursor-pointer flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span>Single combined payment proof for all {applicants.length} applicants</span>
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="individual" id="individual-proof" />
              <Label htmlFor="individual-proof" className="cursor-pointer flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span>Separate payment proof for each applicant</span>
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {uploadMode === "single" && hasMultipleApplicants
              ? `Please upload a single payment proof covering the total amount for all ${applicants.length} applicants.`
              : hasMultipleApplicants
                ? "Please upload a separate payment proof for each applicant. All proofs must be uploaded before submitting."
                : "Please upload your payment proof before submitting."
            }
          </p>
        </div>
      </div>

      {/* Single Combined Upload */}
      {uploadMode === "single" && hasMultipleApplicants ? (
        <div className="space-y-3">
          {/* Applicant Summary */}
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
                </span>
              ))}
            </div>
          </div>

          {/* Single Upload Area */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border transition-colors ${
              paymentProofs.has("combined")
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
                : "bg-background border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">Combined Payment Proof</span>
              </div>

              {paymentProofs.has("combined") ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/40 rounded-lg">
                    {previews.get("combined") ? (
                      <img
                        src={previews.get("combined")}
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
                    onClick={() => removeFile("combined")}
                    className="text-destructive hover:text-destructive h-8 w-8 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <input
                    ref={singleFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => handleFileSelect("combined", e)}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => singleFileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Combined Proof
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      ) : (
        /* Individual Applicant List */
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
      )}

      {/* Total Summary */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <span className="text-muted-foreground">Total Amount:</span>
        <div className="flex items-center gap-1 text-xl font-bold text-primary">
          <IndianRupee className="w-5 h-5" />
          {totalFee.toLocaleString("en-IN")}
        </div>
      </div>

      {/* Validation Message */}
      {!isComplete && (
        <div className="bg-destructive/10 rounded-lg p-3 border border-destructive/30">
          <p className="text-sm text-destructive">
            {uploadMode === "single" && hasMultipleApplicants
              ? "Please upload the combined payment proof before submitting the registration."
              : `Please upload payment proof for all ${applicants.length} applicant(s) before submitting the registration.`
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default BulkPaymentProofUpload;
