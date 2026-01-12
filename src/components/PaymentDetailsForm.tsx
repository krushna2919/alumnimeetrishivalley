import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreditCard, Calendar, ArrowLeft, CheckCircle, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RegistrationData } from "./RegistrationForm";

const paymentSchema = z.object({
  paymentReference: z.string().min(5, "Payment reference must be at least 5 characters").max(50),
  paymentDate: z.string().min(1, "Please enter payment date"),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentDetailsFormProps {
  application: RegistrationData;
  onBack: () => void;
  onComplete: (updatedApplication: RegistrationData) => void;
}

const PaymentDetailsForm = ({ application, onBack, onComplete }: PaymentDetailsFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentReference: "",
      paymentDate: "",
    },
  });

  const onSubmit = async (data: PaymentFormData) => {
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("registrations")
        .update({
          payment_reference: data.paymentReference,
          payment_date: data.paymentDate,
          payment_status: "submitted" as const,
          updated_at: new Date().toISOString(),
        })
        .eq("application_id", application.applicationId);

      if (error) {
        console.error("Payment update error:", error);
        toast.error("Failed to update payment details");
        setIsSubmitting(false);
        return;
      }

      toast.success("Payment details updated successfully!", {
        description: "Your registration is now complete.",
      });
      
      onComplete({
        ...application,
        paymentStatus: "submitted",
      });
    } catch (err) {
      console.error("Payment update error:", err);
      toast.error("Failed to update payment details");
    }

    setIsSubmitting(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const registrationFee = application.stayType === "on-campus" ? "₹15,000" : "₹7,500";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      {/* Application Summary */}
      <div className="bg-primary/5 rounded-xl p-6 border border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-xl font-semibold text-foreground">Application Details</h3>
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Application ID:</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono font-semibold text-primary">{application.applicationId}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(application.applicationId)}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Name:</span>
            <p className="font-medium text-foreground">{application.name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Email:</span>
            <p className="font-medium text-foreground">{application.email}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Registration Type:</span>
            <p className="font-medium text-foreground">
              {application.stayType === "on-campus" ? "On Campus Stay" : "Staying Outside"} ({registrationFee})
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Payment Status:</span>
            <p className={`font-medium ${application.paymentStatus === "submitted" ? "text-green-600" : "text-amber-600"}`}>
              {application.paymentStatus === "submitted" ? "✓ Submitted" : "⏳ Pending"}
            </p>
          </div>
        </div>
      </div>

      {/* Payment Form */}
      {application.paymentStatus === "submitted" ? (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <h4 className="font-semibold text-green-800 dark:text-green-200">Payment Already Submitted</h4>
              <p className="text-green-700 dark:text-green-300 text-sm">
                Your payment details have been submitted successfully.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="bg-secondary/50 rounded-xl p-6 border border-border">
              <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Submit Payment Details
              </h4>
              
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="paymentReference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">
                        Transaction / Reference Number
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., UTR123456789" 
                          {...field} 
                          className="bg-background"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-foreground">
                        <Calendar className="w-4 h-4 text-primary" />
                        Payment Date
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          className="bg-background"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
              >
                {isSubmitting ? "Submitting..." : "Submit Payment Details"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </motion.div>
  );
};

export default PaymentDetailsForm;
