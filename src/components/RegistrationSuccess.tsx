/**
 * RegistrationSuccess.tsx - Post-Registration Success View
 * 
 * Displayed after a successful registration submission.
 * Shows confirmation details, application IDs, and payment summary.
 * 
 * Features:
 * - Primary application ID prominently displayed
 * - Additional registrations listed (for group registrations)
 * - Copy-to-clipboard functionality for application IDs
 * - Payment confirmation status
 * - Option to start a new registration
 * 
 * This component handles both single and group registrations,
 * dynamically adjusting the UI based on the number of registrants.
 */

import { motion } from "framer-motion";
import { CheckCircle, Copy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RegistrationData } from "./registration/types";

/**
 * Interface for additional registration data
 * Used when multiple people are registered in a single submission
 */
interface AdditionalRegistration {
  applicationId: string;
  name: string;
  email: string;
  stayType: string;
  registrationFee: number;
}

/**
 * Props interface for RegistrationSuccess
 */
interface RegistrationSuccessProps {
  /** Primary registration data */
  application: RegistrationData;
  /** Array of additional registrations (optional, for group registrations) */
  additionalRegistrations?: AdditionalRegistration[];
  /** Total fee for all registrations (optional) */
  totalFee?: number;
  /** Callback to reset the form for a new registration */
  onNewRegistration: () => void;
}

/**
 * RegistrationSuccess Component
 * 
 * Displays confirmation after successful registration submission.
 * 
 * @param application - Primary registration details
 * @param additionalRegistrations - Array of group member registrations
 * @param totalFee - Combined fee for all registrations
 * @param onNewRegistration - Handler to start a new registration
 * @returns Success confirmation view with registration details
 */
const RegistrationSuccess = ({ 
  application, 
  additionalRegistrations = [], 
  totalFee,
  onNewRegistration 
}: RegistrationSuccessProps) => {
  
  /**
   * Copies text to clipboard and shows toast notification
   * @param text - Text to copy (application ID)
   */
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Application ID copied to clipboard!");
  };

  // Calculate display values
  const displayFee = totalFee ? `₹${totalFee.toLocaleString()}` : 
    (application.stayType === "on-campus" ? "₹15,000" : "₹7,500");
  const totalPeople = 1 + additionalRegistrations.length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-8"
    >
      {/* Success Icon */}
      <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full mb-6">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>

      {/* Success Message - Dynamic based on number of registrants */}
      <h3 className="font-serif text-2xl font-bold text-foreground mb-2">
        {totalPeople > 1 ? `${totalPeople} Registrations Submitted!` : "Registration Submitted Successfully!"}
      </h3>
      
      <p className="text-muted-foreground mb-6">
        {totalPeople > 1 
          ? "All registrations have been recorded. Please save the Application IDs below."
          : "Your registration has been recorded. Please save your Application ID below."}
      </p>

      {/* Primary Application ID Card - Prominent display */}
      <div className="bg-primary/10 rounded-xl p-6 border-2 border-primary/30 mb-4 inline-block">
        <p className="text-sm text-muted-foreground mb-2">Primary Application ID</p>
        <div className="flex items-center justify-center gap-3">
          <span className="font-mono text-2xl font-bold text-primary">
            {application.applicationId}
          </span>
          {/* Copy button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(application.applicationId)}
            className="hover:bg-primary/20"
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{application.name}</p>
      </div>

      {/* Additional Registrations List - Only shown for group registrations */}
      {additionalRegistrations.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Additional Registrations</p>
          </div>
          <div className="grid gap-2 max-w-md mx-auto">
            {additionalRegistrations.map((reg) => (
              <div key={reg.applicationId} className="bg-secondary/50 rounded-lg p-3 flex items-center justify-between">
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">{reg.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{reg.applicationId}</p>
                </div>
                {/* Copy button for each additional registration */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(reg.applicationId)}
                  className="hover:bg-primary/20"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registration Summary Card */}
      <div className="bg-secondary/50 rounded-xl p-6 text-left max-w-md mx-auto mb-6">
        <h4 className="font-semibold text-foreground mb-3">Registration Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Registrants:</span>
            <span className="font-medium text-foreground">{totalPeople}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 mt-2">
            <span className="text-muted-foreground">Total Amount Paid:</span>
            <span className="font-bold text-primary">{displayFee}</span>
          </div>
        </div>
      </div>

      {/* Payment Confirmation Notice */}
      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800 mb-6 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          <div className="text-left">
            <p className="font-semibold text-green-800 dark:text-green-200 text-sm">Payment Proof Submitted</p>
            <p className="text-green-700 dark:text-green-300 text-sm">
              Your payment proof has been submitted. The organizing committee will verify and confirm your registration via email.
            </p>
          </div>
        </div>
      </div>

      {/* New Registration Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={onNewRegistration}
        >
          New Registration
        </Button>
      </div>
    </motion.div>
  );
};

export default RegistrationSuccess;
