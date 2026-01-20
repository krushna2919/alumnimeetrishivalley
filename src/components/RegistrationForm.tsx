import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, Briefcase, MapPin, Calendar, Building, Home, Loader2, Upload, FileText, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHoneypot } from "@/hooks/useHoneypot";
import { usePostalCodeLookup } from "@/hooks/usePostalCodeLookup";
import { useBatchConfiguration } from "@/hooks/useBatchConfiguration";
import ApplicationLookup from "./ApplicationLookup";
import PaymentDetailsForm from "./PaymentDetailsForm";
import RegistrationSuccess from "./RegistrationSuccess";
import AdditionalAttendeesSection from "./registration/AdditionalAttendeesSection";
import BulkPaymentProofUpload from "./registration/BulkPaymentProofUpload";
import {
  registrantSchema,
  RegistrantData,
  AttendeeData,
  defaultRegistrant,
  calculateFee,
  calculateTotalFee,
  RegistrationData,
  MAX_ATTENDEES,
} from "./registration/types";

type ViewState = "form" | "success" | "payment";

interface RegistrationResult extends RegistrationData {
  additionalRegistrations?: Array<{
    applicationId: string;
    name: string;
    email: string;
    stayType: string;
    registrationFee: number;
  }>;
  totalFee?: number;
  totalRegistrants?: number;
}

const RegistrationForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewState, setViewState] = useState<ViewState>("form");
  const [currentApplication, setCurrentApplication] = useState<RegistrationData | null>(null);
  const [registrationResult, setRegistrationResult] = useState<RegistrationResult | null>(null);
  const [additionalAttendees, setAdditionalAttendees] = useState<AttendeeData[]>([]);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [bulkPaymentProofs, setBulkPaymentProofs] = useState<Map<string, File>>(new Map());
  const { getValidationData, isLikelyBot, resetFormLoadTime, setHoneypotValue } = useHoneypot();
  const { lookupPostalCode, isLoading: isLookingUpPostalCode } = usePostalCodeLookup();
  const { config: batchConfig, yearOptions, isLoading: isLoadingConfig, error: configError, isWithinRegistrationPeriod } = useBatchConfiguration();

  const handlePaymentProofChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB) and type
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File too large", { description: "Please upload a file smaller than 5MB" });
        return;
      }
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Invalid file type", { description: "Please upload a JPG, PNG, WebP or PDF file" });
        return;
      }
      setPaymentProofFile(file);
      toast.success("Payment proof attached", { description: file.name });
    }
  };

  // Check if all required payment proofs are uploaded for bulk registration
  const hasMultipleApplicants = additionalAttendees.length > 0;
  const totalApplicants = 1 + additionalAttendees.length;
  const allBulkProofsUploaded = bulkPaymentProofs.has("combined");

  const form = useForm<RegistrantData>({
    resolver: zodResolver(registrantSchema),
    defaultValues: defaultRegistrant,
  });

  // Watch postal code for auto-population
  const postalCode = form.watch("postalCode");
  const stayType = form.watch("stayType");
  const boardType = form.watch("boardType");

  // Calculate fees
  const registrantFee = calculateFee(stayType);
  const watchedRegistrant = form.watch();
  const totalFee = calculateTotalFee(watchedRegistrant as RegistrantData, additionalAttendees);

  // Debug: keep for now to verify attendee removal updates totals reliably
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[RegistrationForm] attendees:", additionalAttendees.length, "totalFee:", totalFee);
  }, [additionalAttendees.length, totalFee]);

  // Check if submit is allowed based on registration period
  const canSubmit = isWithinRegistrationPeriod();

  // Auto-populate city, district, state from postal code
  useEffect(() => {
    const fetchLocationData = async () => {
      if (postalCode && postalCode.length === 6) {
        const locationData = await lookupPostalCode(postalCode);
        if (locationData) {
          form.setValue("city", locationData.city, { shouldValidate: true });
          form.setValue("district", locationData.district, { shouldValidate: true });
          form.setValue("state", locationData.state, { shouldValidate: true });
          toast.success("Location auto-filled from PIN code");
        }
      }
    };

    fetchLocationData();
  }, [postalCode, lookupPostalCode, form]);

  const onSubmit = async (data: RegistrantData) => {
    setIsSubmitting(true);

    try {
      // Get bot validation data
      const botValidation = getValidationData();

      // Quick client-side check (server does real validation)
      if (isLikelyBot()) {
        toast.error("Verification failed", {
          description: "Please wait a moment and try again.",
        });
        setIsSubmitting(false);
        return;
      }

      const registrationFee = calculateFee(data.stayType);
      
      // Determine the final board type value
      const finalBoardType = data.boardType === "Other" ? data.customBoardType : data.boardType;

      // Prepare additional attendees data - use primary email, include secondary email if provided
      const additionalAttendeesData = additionalAttendees.map((attendee) => ({
        name: attendee.name,
        email: data.email, // Always use primary registrant's email
        secondaryEmail: attendee.secondaryEmail || undefined, // Optional secondary email
        phone: attendee.phone,
        occupation: attendee.occupation,
        boardType: attendee.boardType === "Other" ? attendee.customBoardType : attendee.boardType,
        yearOfPassing: parseInt(attendee.yearOfPassing),
        stayType: attendee.stayType,
        tshirtSize: attendee.tshirtSize,
        gender: attendee.gender,
        registrationFee: calculateFee(attendee.stayType),
      }));

      // Call edge function with bot validation data
      const { data: result, error } = await supabase.functions.invoke("verify-captcha-register", {
          body: {
            botValidation,
            name: data.name,
            email: data.email,
            phone: data.phone,
            occupation: data.occupation,
            boardType: finalBoardType,
            yearOfPassing: parseInt(data.yearOfPassing),
            addressLine1: data.addressLine1,
            addressLine2: data.addressLine2 || undefined,
            city: data.city,
            district: data.district,
            state: data.state,
            postalCode: data.postalCode,
            country: data.country,
            stayType: data.stayType,
            tshirtSize: data.tshirtSize,
            gender: data.gender,
            registrationFee,
            additionalAttendees: additionalAttendeesData.length > 0 ? additionalAttendeesData : undefined,
          },
      });

      if (error) {
        console.error("Registration error code:", error.name);
        toast.error("Registration failed", {
          description: "Unable to complete registration. Please try again later.",
        });
        return;
      }

      if (result.error) {
        toast.error("Registration failed", {
          description: result.error,
        });
        return;
      }

      // Payment proof upload is now always required
      if (hasMultipleApplicants && bulkPaymentProofs.size > 0) {
        // Bulk upload for multiple applicants
        toast.info("Uploading payment proofs...");
        
        // Build mapping of temp IDs to actual application IDs
        // Build application ID map
        const applicationIdMap = new Map<string, string>();
        applicationIdMap.set("primary", result.applicationId);
        
        if (result.additionalRegistrations) {
          result.additionalRegistrations.forEach((reg: { applicationId: string }, index: number) => {
            applicationIdMap.set(`attendee-${index}`, reg.applicationId);
          });
        }

        // Upload the combined proof and link to all applicants
        if (bulkPaymentProofs.has("combined")) {
          const combinedFile = bulkPaymentProofs.get("combined")!;
          const fileExt = combinedFile.name.split('.').pop();
          const fileName = `combined-${result.applicationId}-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('payment-proofs')
            .upload(fileName, combinedFile);

          if (uploadError) {
            console.error("Combined upload error:", uploadError);
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('payment-proofs')
              .getPublicUrl(fileName);

            // Update all registrations with the same proof
            for (const [, actualAppId] of applicationIdMap.entries()) {
              await supabase
                .from("registrations")
                .update({
                  payment_proof_url: publicUrl,
                  payment_status: "submitted" as const,
                  updated_at: new Date().toISOString(),
                })
                .eq("application_id", actualAppId);
            }
          }
        }

        toast.success("Payment proofs uploaded successfully!");
      } else if (paymentProofFile) {
        // Single applicant upload
        toast.info("Uploading payment proof...");
        
        try {
          const fileExt = paymentProofFile.name.split('.').pop();
          const fileName = `${result.applicationId}-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('payment-proofs')
            .upload(fileName, paymentProofFile);

          if (uploadError) {
            console.error("Upload error:", uploadError);
            toast.error("Failed to upload payment proof", {
              description: "Your registration is saved. Please contact support."
            });
          } else {
            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('payment-proofs')
              .getPublicUrl(fileName);

            // Update registration with payment proof
            await supabase
              .from("registrations")
              .update({
                payment_proof_url: publicUrl,
                payment_status: "submitted" as const,
                updated_at: new Date().toISOString(),
              })
              .eq("application_id", result.applicationId);

            toast.success("Payment proof uploaded successfully!");
          }
        } catch (uploadErr) {
          console.error("Error uploading proof:", uploadErr);
        }
      }

      setCurrentApplication(result.registration);
      setRegistrationResult({
        ...result.registration,
        additionalRegistrations: result.additionalRegistrations,
        totalFee: result.totalFee,
        totalRegistrants: result.totalRegistrants,
      });
      setViewState("success");
      resetFormLoadTime();

      const totalRegistered = 1 + (result.additionalRegistrations?.length || 0);
      toast.success(`${totalRegistered} registration${totalRegistered > 1 ? "s" : ""} submitted!`, {
        description: `Primary Application ID: ${result.applicationId}`,
      });
    } catch (error: unknown) {
      console.error("Registration failed");
      toast.error("Registration failed", {
        description: "Unable to complete registration. Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplicationFound = (application: RegistrationData) => {
    setCurrentApplication(application);
    setViewState("payment");
  };

  const handlePaymentComplete = (updatedApplication: RegistrationData) => {
    setCurrentApplication(updatedApplication);
  };

  const handleNewRegistration = () => {
    form.reset();
    setCurrentApplication(null);
    setRegistrationResult(null);
    setAdditionalAttendees([]);
    setPaymentProofFile(null);
    setBulkPaymentProofs(new Map());
    setViewState("form");
  };

  const handleUpdatePayment = () => {
    setViewState("payment");
  };

  const handleBackToForm = () => {
    setViewState("form");
  };

  // Show loading or error state for batch configuration
  if (isLoadingConfig) {
    return (
      <section id="register" className="py-20 gradient-warm">
        <div className="container max-w-4xl px-4">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading registration configuration...</span>
          </div>
        </div>
      </section>
    );
  }

  if (configError || !batchConfig) {
    return (
      <section id="register" className="py-20 gradient-warm">
        <div className="container max-w-4xl px-4">
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Registration Not Available</h3>
            <p className="text-muted-foreground">
              {configError || "Registration configuration is not set up. Please check back later."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Check if registration is open
  if (!batchConfig.isRegistrationOpen) {
    return (
      <section id="register" className="py-20 gradient-warm">
        <div className="container max-w-4xl px-4">
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Registration Closed</h3>
            <p className="text-muted-foreground">
              Registration is currently closed. Please check back later or contact the organizers for more information.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="register" className="py-20 gradient-warm">
      <div className="container max-w-4xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">Registration Form</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Register before 31st August 2026. Accommodation is on a first-come, first-serve basis with preference to
            alumni from older batches.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <span className="inline-block bg-accent/20 text-accent-foreground px-4 py-2 rounded-lg border border-accent/30">
              <strong>Note:</strong> Currently accepting batches from {batchConfig.yearFrom} to {batchConfig.yearTo} only.
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="gradient-card rounded-2xl shadow-card p-8 md:p-12 border border-border"
        >
          {viewState === "form" && (
            <>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  {/* Main Registrant Section */}
                  <div className="pb-6 border-b border-border">
                    <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      Primary Registrant (You)
                    </h3>

                    {/* Personal Information */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-foreground">
                              <User className="w-4 h-4 text-primary" />
                              Full Name
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your full name" {...field} className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-foreground">
                              <Mail className="w-4 h-4 text-primary" />
                              Email Address
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="your.email@example.com"
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
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-foreground">
                              <Phone className="w-4 h-4 text-primary" />
                              Mobile / WhatsApp
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="+91 XXXXX XXXXX" {...field} className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="occupation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-foreground">
                              <Briefcase className="w-4 h-4 text-primary" />
                              Occupation
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="Your current profession" {...field} className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Board Type Selection */}
                    <div className="mt-6">
                      <FormField
                        control={form.control}
                        name="boardType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground font-semibold">Board</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex flex-wrap gap-4 mt-2"
                              >
                                <label className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                                  field.value === "ISC" 
                                    ? "border-primary bg-primary/5" 
                                    : "border-border hover:border-primary/50"
                                }`}>
                                  <RadioGroupItem value="ISC" />
                                  <span className="font-medium text-foreground">ISC</span>
                                </label>
                                
                                <label className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                                  field.value === "ICSE" 
                                    ? "border-primary bg-primary/5" 
                                    : "border-border hover:border-primary/50"
                                }`}>
                                  <RadioGroupItem value="ICSE" />
                                  <span className="font-medium text-foreground">ICSE</span>
                                </label>
                                
                                <label className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                                  field.value === "Other" 
                                    ? "border-primary bg-primary/5" 
                                    : "border-border hover:border-primary/50"
                                }`}>
                                  <RadioGroupItem value="Other" />
                                  <span className="font-medium text-foreground">Other</span>
                                </label>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Custom Board Name Input - shown when "Other" is selected */}
                      {boardType === "Other" && (
                        <div className="mt-4">
                          <FormField
                            control={form.control}
                            name="customBoardType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-foreground">Board Name</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="Enter your board name" 
                                    {...field} 
                                    className="bg-background" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>

                    {/* Year of Passing */}
                    <div className="mt-6">
                      <FormField
                        control={form.control}
                        name="yearOfPassing"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-foreground">
                              <Calendar className="w-4 h-4 text-primary" />
                              Year of Passing
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-background">
                                  <SelectValue placeholder="Select your passing year" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-60">
                                {yearOptions.map((year) => (
                                  <SelectItem key={year} value={year.toString()}>
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Address Section */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      Address Details
                    </h3>

                    <FormField
                      control={form.control}
                      name="addressLine1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Street Address</FormLabel>
                          <FormControl>
                            <Input placeholder="House/Flat No., Street Name" {...field} className="bg-background" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="addressLine2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Address Line 2 (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Landmark, Area" {...field} className="bg-background" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* PIN Code first - for auto-population */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="postalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground flex items-center gap-2">
                              PIN Code
                              {isLookingUpPostalCode && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter 6-digit PIN code"
                                {...field}
                                className="bg-background"
                                maxLength={6}
                              />
                            </FormControl>
                            <FormMessage />
                            <p className="text-xs text-muted-foreground">City, district & state will auto-fill</p>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground">Country</FormLabel>
                            <FormControl>
                              <Input placeholder="Country" {...field} className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-foreground">
                              <Building className="w-4 h-4 text-primary" />
                              City / Post Office
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="Auto-filled from PIN" {...field} className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="district"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground">District</FormLabel>
                            <FormControl>
                              <Input placeholder="Auto-filled from PIN" {...field} className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-foreground">
                              <Home className="w-4 h-4 text-primary" />
                              State
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="Auto-filled from PIN" {...field} className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Stay Type */}
                  <FormField
                    control={form.control}
                    name="stayType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground text-lg font-semibold">Your Registration Type</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="grid md:grid-cols-2 gap-4 mt-3"
                          >
                            <label
                              className={`flex items-start gap-4 p-6 rounded-xl border-2 cursor-pointer transition-all ${
                                field.value === "on-campus"
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50"
                              }`}
                            >
                              <RadioGroupItem value="on-campus" className="mt-1" />
                              <div>
                                <p className="font-semibold text-foreground">On Campus Stay</p>
                                <p className="text-2xl font-bold text-primary mt-1">₹15,000</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                  Includes accommodation, all meals & full event access
                                </p>
                              </div>
                            </label>

                            <label
                              className={`flex items-start gap-4 p-6 rounded-xl border-2 cursor-pointer transition-all ${
                                field.value === "outside"
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50"
                              }`}
                            >
                              <RadioGroupItem value="outside" className="mt-1" />
                              <div>
                                <p className="font-semibold text-foreground">Staying Outside</p>
                                <p className="text-2xl font-bold text-primary mt-1">₹7,500</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                  Full event access, lunch & dinner included (no breakfast)
                                </p>
                              </div>
                            </label>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* T-Shirt & Gender */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="tshirtSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">T-Shirt Size</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Select size" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel className="text-muted-foreground font-normal">Select size</SelectLabel>
                                <SelectItem value="S (Chest: 36&quot;)">S (Chest: 36")</SelectItem>
                                <SelectItem value="M (Chest: 38-40&quot;)">M (Chest: 38-40")</SelectItem>
                                <SelectItem value="L (Chest: 42&quot;)">L (Chest: 42")</SelectItem>
                                <SelectItem value="XL (Chest: 44&quot;)">XL (Chest: 44")</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Gender</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel className="text-muted-foreground font-normal">Select gender</SelectLabel>
                                <SelectItem value="M">Male</SelectItem>
                                <SelectItem value="F">Female</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Additional Attendees Section */}
                  <div className="pt-6 border-t border-border">
                    <AdditionalAttendeesSection
                      attendees={additionalAttendees}
                      onAttendeesChange={(attendees) => setAdditionalAttendees(attendees.map((a) => ({ ...a })))}
                      yearOptions={yearOptions}
                      primaryEmail={form.watch("email")}
                    />
                  </div>

                  {/* Payment Proof Upload Section - Mandatory */}
                  <div className="pt-6 border-t border-border space-y-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      Payment Proof Upload (Required)
                    </h3>

                    {/* Important Payment Notice */}
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-amber-800 dark:text-amber-200">
                            Important: Full Payment Required
                          </p>
                          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                            <strong>Full payment towards the registration must be made.</strong> Partial payment proofs should not be submitted. 
                            Please ensure you have your payment proof (screenshot/PDF) ready before proceeding with the form submission.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Payment Proof Upload */}
                    <div className="p-4 bg-accent/10 rounded-lg border border-accent/20 space-y-4">
                      {hasMultipleApplicants ? (
                        /* Bulk Payment Proof Upload for multiple applicants */
                        <BulkPaymentProofUpload
                          key={`bulk-upload-${additionalAttendees.length}`}
                          registrant={form.watch()}
                          additionalAttendees={additionalAttendees}
                          paymentProofs={bulkPaymentProofs}
                          onPaymentProofsChange={setBulkPaymentProofs}
                        />
                      ) : (
                        /* Single applicant - original upload UI */
                        <>
                          <div className="flex items-center gap-2 text-foreground font-medium">
                            <Upload className="w-4 h-4 text-primary" />
                            Upload Payment Proof
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Please upload a screenshot or PDF of your payment confirmation (Max 5MB).
                          </p>
                          <div className="flex flex-col gap-3">
                            <input
                              type="file"
                              id="payment-proof"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              onChange={handlePaymentProofChange}
                              className="hidden"
                            />
                            <label
                              htmlFor="payment-proof"
                              className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-background border border-border rounded-lg cursor-pointer hover:bg-accent/10 transition-colors"
                            >
                              <Upload className="w-4 h-4 text-primary" />
                              <span className="text-foreground">
                                {paymentProofFile ? paymentProofFile.name : "Choose file..."}
                              </span>
                            </label>
                            {paymentProofFile && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileText className="w-4 h-4" />
                                <span>{(paymentProofFile.size / 1024).toFixed(1)} KB</span>
                                <button
                                  type="button"
                                  onClick={() => setPaymentProofFile(null)}
                                  className="ml-2 text-destructive hover:underline"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Honeypot field - hidden from humans, visible to bots */}
                  <input
                    type="text"
                    name="website_url"
                    autoComplete="off"
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
                    onChange={(e) => setHoneypotValue(e.target.value)}
                  />

                  {/* Submit */}
                  <div className="pt-6 border-t border-border">
                    {!canSubmit && (
                      <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-amber-800 dark:text-amber-200">
                              Registration Period
                            </p>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                              Registration is only allowed between the configured start and end dates.
                              {batchConfig?.registrationStartDate && (
                                <span className="block mt-1">
                                  Start: {new Date(batchConfig.registrationStartDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                                </span>
                              )}
                              {batchConfig?.registrationEndDate && (
                                <span className="block">
                                  End: {new Date(batchConfig.registrationEndDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="text-center md:text-left">
                        <p className="text-muted-foreground">
                          Total Registration Fee
                          {additionalAttendees.length > 0 && (
                            <span className="text-sm ml-1">({1 + additionalAttendees.length} people)</span>
                          )}
                        </p>
                        <p className="text-3xl font-bold text-primary">₹{totalFee.toLocaleString()}</p>
                        {additionalAttendees.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            You: ₹{registrantFee.toLocaleString()} + {additionalAttendees.length} attendee(s)
                          </p>
                        )}
                      </div>
                      <Button
                        type="submit"
                        size="lg"
                        disabled={
                          isSubmitting || 
                          !canSubmit || 
                          (hasMultipleApplicants && !allBulkProofsUploaded) ||
                          (!hasMultipleApplicants && !paymentProofFile)
                        }
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-12 py-6 text-lg rounded-full shadow-card hover:shadow-elevated transition-all disabled:opacity-50"
                      >
                        {isSubmitting
                          ? "Submitting..."
                          : !canSubmit 
                            ? "Registration Period Closed"
                            : hasMultipleApplicants && !allBulkProofsUploaded
                              ? `Upload all ${totalApplicants} payment proofs`
                              : !hasMultipleApplicants && !paymentProofFile
                                ? "Upload payment proof to submit"
                                : `Submit ${additionalAttendees.length > 0 ? `${1 + additionalAttendees.length} Registrations` : "Registration"}`}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </>
          )}

          {viewState === "success" && currentApplication && (
            <RegistrationSuccess
              application={currentApplication}
              additionalRegistrations={registrationResult?.additionalRegistrations}
              totalFee={registrationResult?.totalFee}
              onNewRegistration={handleNewRegistration}
            />
          )}

          {viewState === "payment" && currentApplication && (
            <PaymentDetailsForm
              application={currentApplication}
              onBack={handleBackToForm}
              onComplete={handlePaymentComplete}
            />
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default RegistrationForm;
