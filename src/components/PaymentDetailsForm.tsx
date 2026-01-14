import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CreditCard, Calendar, ArrowLeft, CheckCircle, Copy, Users, IndianRupee } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RegistrationData } from "./registration/types";

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
  const [relatedRegistrations, setRelatedRegistrations] = useState<RegistrationData[]>([]);
  const [selectedApplications, setSelectedApplications] = useState<Set<string>>(new Set([application.applicationId]));
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentReference: "",
      paymentDate: "",
    },
  });

  // Fetch related registrations (additional attendees linked to this primary registrant)
  useEffect(() => {
    const fetchRelatedRegistrations = async () => {
      setIsLoadingRelated(true);
      try {
        // Fetch registrations where parent_application_id matches current application
        // OR if this is a child, fetch siblings and parent
        const { data: children, error: childrenError } = await supabase
          .from("registrations")
          .select("application_id, name, email, stay_type, registration_fee, payment_status, created_at, parent_application_id")
          .eq("parent_application_id", application.applicationId);

        if (childrenError) {
          console.error("Error fetching child registrations:", childrenError);
        }

        let allRelated: RegistrationData[] = [];

        if (children && children.length > 0) {
          // This is a primary registrant - add all children
          allRelated = children.map(reg => ({
            applicationId: reg.application_id,
            name: reg.name,
            email: reg.email,
            stayType: reg.stay_type,
            registrationFee: reg.registration_fee,
            paymentStatus: reg.payment_status,
            createdAt: reg.created_at,
            parentApplicationId: reg.parent_application_id,
          }));
        } else if (application.parentApplicationId) {
          // This is a child - fetch parent and siblings
          const { data: parent, error: parentError } = await supabase
            .from("registrations")
            .select("application_id, name, email, stay_type, registration_fee, payment_status, created_at")
            .eq("application_id", application.parentApplicationId)
            .maybeSingle();

          if (parent && !parentError) {
            allRelated.push({
              applicationId: parent.application_id,
              name: parent.name,
              email: parent.email,
              stayType: parent.stay_type,
              registrationFee: parent.registration_fee,
              paymentStatus: parent.payment_status,
              createdAt: parent.created_at,
              parentApplicationId: null,
            });
          }

          // Fetch siblings
          const { data: siblings, error: siblingsError } = await supabase
            .from("registrations")
            .select("application_id, name, email, stay_type, registration_fee, payment_status, created_at, parent_application_id")
            .eq("parent_application_id", application.parentApplicationId)
            .neq("application_id", application.applicationId);

          if (siblings && !siblingsError) {
            allRelated.push(...siblings.map(reg => ({
              applicationId: reg.application_id,
              name: reg.name,
              email: reg.email,
              stayType: reg.stay_type,
              registrationFee: reg.registration_fee,
              paymentStatus: reg.payment_status,
              createdAt: reg.created_at,
              parentApplicationId: reg.parent_application_id,
            })));
          }
        }

        setRelatedRegistrations(allRelated);
      } catch (err) {
        console.error("Error fetching related registrations:", err);
      }
      setIsLoadingRelated(false);
    };

    fetchRelatedRegistrations();
  }, [application.applicationId, application.parentApplicationId]);

  const allRegistrations = [application, ...relatedRegistrations];
  
  const selectedTotal = allRegistrations
    .filter(reg => selectedApplications.has(reg.applicationId))
    .reduce((sum, reg) => sum + reg.registrationFee, 0);

  const pendingPaymentRegistrations = allRegistrations.filter(
    reg => reg.paymentStatus !== "submitted"
  );

  const toggleSelection = (applicationId: string) => {
    const registration = allRegistrations.find(r => r.applicationId === applicationId);
    if (registration?.paymentStatus === "submitted") return; // Can't toggle already submitted

    const newSelection = new Set(selectedApplications);
    if (newSelection.has(applicationId)) {
      newSelection.delete(applicationId);
    } else {
      newSelection.add(applicationId);
    }
    setSelectedApplications(newSelection);
  };

  const selectAll = () => {
    const newSelection = new Set<string>();
    pendingPaymentRegistrations.forEach(reg => {
      newSelection.add(reg.applicationId);
    });
    setSelectedApplications(newSelection);
  };

  const onSubmit = async (data: PaymentFormData) => {
    if (selectedApplications.size === 0) {
      toast.error("Please select at least one registration for payment");
      return;
    }

    setIsSubmitting(true);

    try {
      // Update all selected registrations with payment details
      const selectedIds = Array.from(selectedApplications);
      
      const { error } = await supabase
        .from("registrations")
        .update({
          payment_reference: data.paymentReference,
          payment_date: data.paymentDate,
          payment_status: "submitted" as const,
          updated_at: new Date().toISOString(),
        })
        .in("application_id", selectedIds);

      if (error) {
        console.error("Payment update error:", error);
        toast.error("Failed to update payment details");
        setIsSubmitting(false);
        return;
      }

      toast.success(`Payment details updated for ${selectedIds.length} registration(s)!`, {
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

  const formatFee = (fee: number) => `₹${fee.toLocaleString('en-IN')}`;

  const hasMultipleRegistrations = relatedRegistrations.length > 0;
  const allAlreadySubmitted = pendingPaymentRegistrations.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl font-semibold text-foreground">Payment Details</h3>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Registration Selection Section */}
      {isLoadingRelated ? (
        <div className="bg-secondary/50 rounded-xl p-6 border border-border">
          <p className="text-muted-foreground text-center">Loading related registrations...</p>
        </div>
      ) : (
        <div className="bg-primary/5 rounded-xl p-6 border border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h4 className="font-semibold text-foreground">
                {hasMultipleRegistrations 
                  ? `Select Registrations for Payment (${allRegistrations.length} total)`
                  : "Registration Details"
                }
              </h4>
            </div>
            {hasMultipleRegistrations && pendingPaymentRegistrations.length > 1 && (
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All Pending
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {allRegistrations.map((reg) => {
              const isSelected = selectedApplications.has(reg.applicationId);
              const isSubmitted = reg.paymentStatus === "submitted";
              const isPrimary = reg.applicationId === application.applicationId && !application.parentApplicationId;
              
              return (
                <div
                  key={reg.applicationId}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                    isSubmitted 
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                      : isSelected 
                        ? "bg-primary/10 border-primary/30" 
                        : "bg-background border-border hover:border-primary/20"
                  }`}
                >
                  <Checkbox
                    checked={isSelected || isSubmitted}
                    onCheckedChange={() => toggleSelection(reg.applicationId)}
                    disabled={isSubmitted}
                    className="data-[state=checked]:bg-primary"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">{reg.name}</span>
                      {isPrimary && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          Primary
                        </span>
                      )}
                      {isSubmitted && (
                        <span className="text-xs bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Paid
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span className="font-mono text-xs">{reg.applicationId}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => copyToClipboard(reg.applicationId)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {reg.stayType === "on-campus" ? "On Campus Stay" : "Staying Outside"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={`font-semibold ${isSubmitted ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
                      {formatFee(reg.registrationFee)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total for selected */}
          {hasMultipleRegistrations && (
            <div className="mt-4 pt-4 border-t border-primary/20 flex items-center justify-between">
              <span className="text-muted-foreground">Selected Payment Total:</span>
              <div className="flex items-center gap-1 text-xl font-bold text-primary">
                <IndianRupee className="w-5 h-5" />
                {selectedTotal.toLocaleString('en-IN')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Form or Already Submitted Message */}
      {allAlreadySubmitted ? (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <h4 className="font-semibold text-green-800 dark:text-green-200">All Payments Submitted</h4>
              <p className="text-green-700 dark:text-green-300 text-sm">
                Payment details have been submitted for all registrations.
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
              
              {selectedApplications.size === 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mb-4 border border-amber-200 dark:border-amber-800">
                  <p className="text-amber-700 dark:text-amber-300 text-sm">
                    ⚠️ Please select at least one registration above to submit payment for.
                  </p>
                </div>
              )}
              
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

            {/* Summary before submit */}
            <div className="bg-accent/30 rounded-xl p-4 border border-accent/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Submitting payment for {selectedApplications.size} registration(s)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Array.from(selectedApplications).join(", ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatFee(selectedTotal)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting || selectedApplications.size === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
              >
                {isSubmitting 
                  ? "Submitting..." 
                  : `Submit Payment for ${selectedApplications.size} Registration(s)`
                }
              </Button>
            </div>
          </form>
        </Form>
      )}
    </motion.div>
  );
};

export default PaymentDetailsForm;