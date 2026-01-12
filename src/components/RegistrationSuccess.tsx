import { motion } from "framer-motion";
import { CheckCircle, Copy, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ApplicationData } from "@/lib/applicationStorage";

interface RegistrationSuccessProps {
  application: ApplicationData;
  onUpdatePayment: () => void;
  onNewRegistration: () => void;
}

const RegistrationSuccess = ({ application, onUpdatePayment, onNewRegistration }: RegistrationSuccessProps) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Application ID copied to clipboard!");
  };

  const registrationFee = application.stayType === "on-campus" ? "₹15,000" : "₹7,500";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-8"
    >
      <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full mb-6">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>

      <h3 className="font-serif text-2xl font-bold text-foreground mb-2">
        Registration Submitted Successfully!
      </h3>
      
      <p className="text-muted-foreground mb-6">
        Your registration has been recorded. Please save your Application ID below.
      </p>

      {/* Application ID Card */}
      <div className="bg-primary/10 rounded-xl p-6 border-2 border-primary/30 mb-6 inline-block">
        <p className="text-sm text-muted-foreground mb-2">Your Application ID</p>
        <div className="flex items-center justify-center gap-3">
          <span className="font-mono text-2xl font-bold text-primary">
            {application.applicationId}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(application.applicationId)}
            className="hover:bg-primary/20"
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-secondary/50 rounded-xl p-6 text-left max-w-md mx-auto mb-6">
        <h4 className="font-semibold text-foreground mb-3">Registration Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name:</span>
            <span className="font-medium text-foreground">{application.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email:</span>
            <span className="font-medium text-foreground">{application.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Registration Type:</span>
            <span className="font-medium text-foreground">
              {application.stayType === "on-campus" ? "On Campus" : "Outside"}
            </span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 mt-2">
            <span className="text-muted-foreground">Amount Due:</span>
            <span className="font-bold text-primary">{registrationFee}</span>
          </div>
        </div>
      </div>

      {/* Payment Reminder */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800 mb-6 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="text-left">
            <p className="font-semibold text-amber-800 dark:text-amber-200 text-sm">Payment Required</p>
            <p className="text-amber-700 dark:text-amber-300 text-sm">
              Please complete your payment and submit the payment details to confirm your registration.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          onClick={onUpdatePayment}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Submit Payment Details
        </Button>
        <Button
          variant="outline"
          onClick={onNewRegistration}
        >
          Register Another Person
        </Button>
      </div>
    </motion.div>
  );
};

export default RegistrationSuccess;
