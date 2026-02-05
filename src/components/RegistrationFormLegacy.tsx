/**
 * RegistrationFormLegacy.tsx - Registration Form for 1930-1980 Alumni
 * 
 * This is a parallel registration form specifically for alumni from batches
 * 1930 to 1980. It uses a fixed year range instead of the dynamic batch
 * configuration from the database.
 * 
 * Accessed via: https://alumnimeetrishivalley.org/#register1930-1980
 */

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, Briefcase, MapPin, Building, Home, Loader2, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHoneypot } from "@/hooks/useHoneypot";
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
import { usePostalCodeLookup } from "@/hooks/usePostalCodeLookup";

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

// Fixed year range for legacy alumni (1930-1980)
const LEGACY_YEAR_FROM = 1930;
const LEGACY_YEAR_TO = 1980;

// Generate year options in descending order
const legacyYearOptions = Array.from(
  { length: LEGACY_YEAR_TO - LEGACY_YEAR_FROM + 1 },
  (_, i) => LEGACY_YEAR_TO - i
);

const RegistrationFormLegacy = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewState, setViewState] = useState<ViewState>("form");
  const [currentApplication, setCurrentApplication] = useState<RegistrationData | null>(null);
  const [registrationResult, setRegistrationResult] = useState<RegistrationResult | null>(null);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [bulkPaymentProofs, setBulkPaymentProofs] = useState<Map<string, File>>(new Map());
  const { getValidationData, isLikelyBot, resetFormLoadTime, setHoneypotValue } = useHoneypot();

  const handlePaymentProofChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
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

  const form = useForm<RegistrantData>({
    resolver: zodResolver(registrantSchema),
    defaultValues: defaultRegistrant,
    shouldUnregister: true,
  });

  const additionalAttendees =
    useWatch({ control: form.control, name: "attendees" }) || [];

  const hasMultipleApplicants = additionalAttendees.length > 0;
  const totalApplicants = 1 + additionalAttendees.length;
  const allBulkProofsUploaded = bulkPaymentProofs.has("combined");

  const stayType = useWatch({ control: form.control, name: "stayType" });
  const boardType = useWatch({ control: form.control, name: "boardType" });
  const postalCode = useWatch({ control: form.control, name: "postalCode" });
  const primaryEmail = useWatch({ control: form.control, name: "email" }) || "";

  const { isLoading: isLookingUpPostal, lookupPostalCode } = usePostalCodeLookup();

  const handlePostalCodeBlur = async () => {
    if (postalCode && postalCode.length >= 5) {
      const data = await lookupPostalCode(postalCode);
      if (data) {
        if (data.city) form.setValue("city", data.city);
        if (data.district) form.setValue("district", data.district);
        if (data.state) form.setValue("state", data.state);
        form.setValue("country", "India");
      }
    }
  };

  const watchedRegistrant = useWatch({ control: form.control }) as RegistrantData;
  const registrantFee = calculateFee(watchedRegistrant?.stayType ?? "on-campus");
  const totalFee = calculateTotalFee(watchedRegistrant, additionalAttendees);

  const onSubmit = async (data: RegistrantData) => {
    setIsSubmitting(true);

    try {
      const botValidation = getValidationData();

      if (isLikelyBot()) {
        toast.error("Verification failed", {
          description: "Please wait a moment and try again.",
        });
        setIsSubmitting(false);
        return;
      }

      const registrationFee = calculateFee(data.stayType);
      const finalBoardType = data.boardType === "Other" ? data.customBoardType : data.boardType;

      const attendeesToSubmit = data.attendees || [];
      const additionalAttendeesData = attendeesToSubmit.map((attendee) => ({
        name: attendee.name,
        email: data.email,
        secondaryEmail: attendee.secondaryEmail || undefined,
        phone: attendee.phone,
        occupation: attendee.occupation,
        boardType: attendee.boardType === "Other" ? attendee.customBoardType : attendee.boardType,
        yearOfPassing: parseInt(attendee.yearOfPassing),
        stayType: attendee.stayType,
        tshirtSize: attendee.tshirtSize,
        gender: attendee.gender,
        registrationFee: calculateFee(attendee.stayType),
      }));

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

      // Handle payment proof upload (same logic as main form)
      if (hasMultipleApplicants && bulkPaymentProofs.size > 0) {
        toast.info("Uploading payment proofs...");
        
        const applicationIdMap = new Map<string, string>();
        applicationIdMap.set("primary", result.applicationId);
        
        if (result.additionalRegistrations) {
          result.additionalRegistrations.forEach((reg: { applicationId: string }, index: number) => {
            applicationIdMap.set(`attendee-${index}`, reg.applicationId);
          });
        }

        if (bulkPaymentProofs.has("combined")) {
          const combinedFile = bulkPaymentProofs.get("combined")!;
          const fileExt = combinedFile.name.split('.').pop();
          const fileName = `combined-${result.applicationId}-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('payment-proofs')
            .upload(fileName, combinedFile);

          if (uploadError) {
            console.error("Combined upload error:", uploadError);
            toast.error("Failed to upload payment proof", {
              description: "Your registration is saved. Please use 'Already registered?' to upload proof later."
            });
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('payment-proofs')
              .getPublicUrl(fileName);

            let updateFailed = false;
            const updatePayload = {
              payment_proof_url: publicUrl,
              payment_status: "submitted" as const,
              updated_at: new Date().toISOString(),
            };

            for (const [, actualAppId] of applicationIdMap.entries()) {
              let lastError: unknown = null;
              for (let attempt = 1; attempt <= 3; attempt++) {
                const { error } = await supabase
                  .from("registrations")
                  .update(updatePayload)
                  .eq("application_id", actualAppId);

                if (!error) {
                  lastError = null;
                  break;
                }

                lastError = error;
                await new Promise((r) => setTimeout(r, 400 * attempt));
              }

              if (lastError) {
                console.error(`Failed to update registration ${actualAppId} after retries:`, lastError);
                updateFailed = true;
              }
            }
            
            if (updateFailed) {
              toast.warning("Payment proof uploaded but link may not be saved", {
                description: "Please use 'Already registered?' to verify or re-upload."
              });
            }
          }
        }

        toast.success("Payment proofs uploaded successfully!");
      } else if (paymentProofFile) {
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
            const { data: { publicUrl } } = supabase.storage
              .from('payment-proofs')
              .getPublicUrl(fileName);

            const updatePayload = {
              payment_proof_url: publicUrl,
              payment_status: "submitted" as const,
              updated_at: new Date().toISOString(),
            };

            let updateError: unknown = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
              const { error } = await supabase
                .from("registrations")
                .update(updatePayload)
                .eq("application_id", result.applicationId);

              if (!error) {
                updateError = null;
                break;
              }

              updateError = error;
              await new Promise((r) => setTimeout(r, 400 * attempt));
            }

            if (updateError) {
              console.error("Failed to link payment proof after retries:", updateError);
              toast.warning("Payment proof uploaded but link may not be saved", {
                description: "Your proof is uploaded. If it doesn't show up, use 'Already registered?' to re-link it.",
              });
            } else {
              toast.success("Payment proof uploaded successfully!");
            }
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
    form.reset(defaultRegistrant);
    setCurrentApplication(null);
    setRegistrationResult(null);
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

  return (
    <section id="register1930-1980" className="py-20 gradient-warm">
      <div className="container max-w-4xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">
            Registration Form
          </h2>
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-4 max-w-2xl mx-auto">
            <p className="text-primary font-semibold text-lg">
              🎓 Exclusive Registration for Alumni from Batches 1930 - 1980
            </p>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Register before 31st August 2026. Accommodation is on a first-come, first-serve basis with preference to
            alumni from older batches.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <span className="inline-block bg-accent/20 text-accent-foreground px-4 py-2 rounded-lg border border-accent/30">
              <strong>Note:</strong> This form accepts batches from {LEGACY_YEAR_FROM} to {LEGACY_YEAR_TO} only.
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
          {viewState === "success" && registrationResult ? (
            <RegistrationSuccess
              application={registrationResult}
              additionalRegistrations={registrationResult.additionalRegistrations}
              totalFee={registrationResult.totalFee}
              onNewRegistration={handleNewRegistration}
            />
          ) : viewState === "payment" && currentApplication ? (
            <PaymentDetailsForm
              application={currentApplication}
              onComplete={handlePaymentComplete}
              onBack={handleBackToForm}
            />
          ) : (
            <>
              <ApplicationLookup onApplicationFound={handleApplicationFound} />

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or register as new applicant</span>
                </div>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  {/* Honeypot field */}
                  <div className="absolute -left-[9999px] opacity-0 pointer-events-none" aria-hidden="true">
                    <label htmlFor="website_url">Website</label>
                    <input
                      type="text"
                      id="website_url"
                      name="website_url"
                      tabIndex={-1}
                      autoComplete="off"
                      onChange={(e) => setHoneypotValue(e.target.value)}
                    />
                  </div>

                  {/* Personal Information */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      Personal Information
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your full name" {...field} />
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
                            <FormLabel>Email Address *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="your@email.com" className="pl-10" {...field} />
                              </div>
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
                            <FormLabel>Phone / WhatsApp Number *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="+91 98765 43210" className="pl-10" {...field} />
                              </div>
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
                            <FormLabel>Occupation *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Briefcase className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Your current occupation" className="pl-10" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gender *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="M">Male</SelectItem>
                                <SelectItem value="F">Female</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="tshirtSize"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>T-Shirt Size *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value='S (Chest: 36")'>S (Chest: 36")</SelectItem>
                                <SelectItem value='M (Chest: 38-40")'>M (Chest: 38-40")</SelectItem>
                                <SelectItem value='L (Chest: 42")'>L (Chest: 42")</SelectItem>
                                <SelectItem value='XL (Chest: 44")'>XL (Chest: 44")</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* School Information */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Building className="w-5 h-5 text-primary" />
                      School Information
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="boardType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Board *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select your board" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="ISC">ISC</SelectItem>
                                <SelectItem value="ICSE">ICSE</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {boardType === "Other" && (
                        <FormField
                          control={form.control}
                          name="customBoardType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Board Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter your board name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="yearOfPassing"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Year of Passing *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select year" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[200px]">
                                <SelectGroup>
                                  <SelectLabel>
                                    Batches {LEGACY_YEAR_FROM} - {LEGACY_YEAR_TO}
                                  </SelectLabel>
                                  {legacyYearOptions.map((year) => (
                                    <SelectItem key={year} value={year.toString()}>
                                      {year}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Address Information */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-primary" />
                      Address Information
                    </h3>

                    <div className="grid grid-cols-1 gap-6">
                      <FormField
                        control={form.control}
                        name="addressLine1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address Line 1 *</FormLabel>
                            <FormControl>
                              <Input placeholder="House/Flat No., Street Name" {...field} />
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
                            <FormLabel>Address Line 2</FormLabel>
                            <FormControl>
                              <Input placeholder="Landmark, Area (Optional)" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="postalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal Code *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  placeholder="Enter postal code"
                                  {...field}
                                  onBlur={(e) => {
                                    field.onBlur();
                                    handlePostalCodeBlur();
                                  }}
                                />
                                {isLookingUpPostal && (
                                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City *</FormLabel>
                            <FormControl>
                              <Input placeholder="City" {...field} />
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
                            <FormLabel>District *</FormLabel>
                            <FormControl>
                              <Input placeholder="District" {...field} />
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
                            <FormLabel>State *</FormLabel>
                            <FormControl>
                              <Input placeholder="State" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country *</FormLabel>
                            <FormControl>
                              <Input placeholder="Country" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Stay Preference */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Home className="w-5 h-5 text-primary" />
                      Stay Preference
                    </h3>

                    <FormField
                      control={form.control}
                      name="stayType"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Where would you like to stay? *</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="flex flex-col space-y-3"
                            >
                              <div className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                                <RadioGroupItem value="on-campus" id="on-campus" />
                                <label
                                  htmlFor="on-campus"
                                  className="flex-1 cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  <span className="block">On Campus</span>
                                  <span className="block text-muted-foreground font-normal mt-1">
                                    Stay in school hostels - ₹15,000 (includes accommodation, all meals & event access)
                                  </span>
                                </label>
                              </div>
                              <div className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                                <RadioGroupItem value="outside" id="outside" />
                                <label
                                  htmlFor="outside"
                                  className="flex-1 cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  <span className="block">Outside Campus</span>
                                  <span className="block text-muted-foreground font-normal mt-1">
                                    Arrange your own stay - ₹7,500 (includes event access, lunch & dinner only)
                                  </span>
                                </label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {stayType && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-primary/5 p-4 rounded-lg border border-primary/20"
                      >
                        <p className="text-sm font-medium text-foreground">
                          Registration Fee: <span className="text-primary text-lg">₹{registrantFee.toLocaleString()}</span>
                        </p>
                      </motion.div>
                    )}
                  </div>

                  {/* Additional Attendees Section */}
                  <AdditionalAttendeesSection
                    form={form}
                    yearOptions={legacyYearOptions}
                    primaryEmail={primaryEmail}
                  />

                  {/* Fee Summary */}
                  {stayType && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-r from-primary/10 to-accent/10 p-6 rounded-xl border border-primary/20"
                    >
                      <h4 className="font-semibold text-foreground mb-3">Fee Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Primary Registrant</span>
                          <span className="font-medium">₹{registrantFee.toLocaleString()}</span>
                        </div>
                        {additionalAttendees.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Additional Attendees ({additionalAttendees.length})
                            </span>
                            <span className="font-medium">
                              ₹{(totalFee - registrantFee).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <div className="border-t border-border pt-2 mt-2">
                          <div className="flex justify-between text-lg font-bold">
                            <span>Total Amount</span>
                            <span className="text-primary">₹{totalFee.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Payment Proof Upload */}
                  {stayType && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        Payment Proof
                      </h3>

                      {hasMultipleApplicants ? (
                        <BulkPaymentProofUpload
                          registrant={watchedRegistrant}
                          additionalAttendees={additionalAttendees}
                          paymentProofs={bulkPaymentProofs}
                          onPaymentProofsChange={setBulkPaymentProofs}
                        />
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Upload your payment receipt (JPG, PNG, WebP or PDF, max 5MB)
                          </p>
                          <div className="flex items-center gap-4">
                            <label
                              htmlFor="payment-proof"
                              className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
                            >
                              <Upload className="w-4 h-4" />
                              {paymentProofFile ? "Change File" : "Upload Proof"}
                            </label>
                            <input
                              type="file"
                              id="payment-proof"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              onChange={handlePaymentProofChange}
                              className="hidden"
                            />
                            {paymentProofFile && (
                              <span className="text-sm text-muted-foreground">{paymentProofFile.name}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full btn-gradient text-lg py-6"
                    disabled={
                      isSubmitting ||
                      !stayType ||
                      (hasMultipleApplicants ? !allBulkProofsUploaded : !paymentProofFile)
                    }
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Submitting Registration...
                      </>
                    ) : (
                      `Complete Registration (₹${totalFee.toLocaleString()})`
                    )}
                  </Button>

                  {(hasMultipleApplicants ? !allBulkProofsUploaded : !paymentProofFile) && stayType && (
                    <p className="text-center text-sm text-destructive">
                      Please upload payment proof to complete registration
                    </p>
                  )}
                </form>
              </Form>
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default RegistrationFormLegacy;
