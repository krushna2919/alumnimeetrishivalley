import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, Briefcase, MapPin, Calendar, Building, Home, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { usePostalCodeLookup } from "@/hooks/usePostalCodeLookup";
import ApplicationLookup from "./ApplicationLookup";
import PaymentDetailsForm from "./PaymentDetailsForm";
import RegistrationSuccess from "./RegistrationSuccess";

const currentYear = new Date().getFullYear();
const CUTOFF_YEAR = 1980;

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number").max(15),
  occupation: z.string().min(2, "Please enter your occupation").max(100),
  yearOfPassing: z.string().refine((val) => {
    const year = parseInt(val);
    return year <= CUTOFF_YEAR && year >= 1930;
  }, `Registration is currently open only for batches of ${CUTOFF_YEAR} and earlier.`),
  addressLine1: z.string().min(5, "Please enter your street address").max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(2, "Please enter your city").max(100),
  district: z.string().min(2, "Please enter your district").max(100),
  state: z.string().min(2, "Please enter your state").max(100),
  postalCode: z.string().min(5, "Please enter a valid postal code").max(10),
  country: z.string().default("India"),
  stayType: z.enum(["on-campus", "outside"]),
  tshirtSize: z.enum(["S", "M", "L", "XL"]),
  gender: z.enum(["M", "F"]),
});

type FormData = z.infer<typeof formSchema>;

export interface RegistrationData {
  applicationId: string;
  name: string;
  email: string;
  stayType: string;
  registrationFee: number;
  paymentStatus: string;
  createdAt: string;
}

type ViewState = "form" | "success" | "payment";

const RegistrationForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewState, setViewState] = useState<ViewState>("form");
  const [currentApplication, setCurrentApplication] = useState<RegistrationData | null>(null);
  const { executeRecaptcha } = useRecaptcha();
  const { lookupPostalCode, isLoading: isLookingUpPostalCode } = usePostalCodeLookup();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      occupation: "",
      yearOfPassing: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      district: "",
      state: "",
      postalCode: "",
      country: "India",
      stayType: "on-campus",
      tshirtSize: "M",
      gender: "M",
    },
  });

  // Watch postal code for auto-population
  const postalCode = form.watch("postalCode");

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

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    try {
      // Execute reCAPTCHA
      const captchaToken = await executeRecaptcha("register");
      
      const registrationFee = data.stayType === "on-campus" ? 15000 : 7500;

      // Call edge function with captcha token
      const { data: result, error } = await supabase.functions.invoke("verify-captcha-register", {
        body: {
          captchaToken,
          name: data.name,
          email: data.email,
          phone: data.phone,
          occupation: data.occupation,
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
        },
      });

      if (error) {
        console.error("Registration error:", error);
        toast.error("Registration failed", {
          description: error.message || "Please try again later.",
        });
        return;
      }

      if (result.error) {
        toast.error("Registration failed", {
          description: result.error,
        });
        return;
      }

      setCurrentApplication(result.registration);
      setViewState("success");
      
      toast.success("Registration submitted!", {
        description: `Application ID: ${result.applicationId}`,
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error("Registration failed", {
        description: error.message || "Please try again later.",
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
    setViewState("form");
  };

  const handleUpdatePayment = () => {
    setViewState("payment");
  };

  const handleBackToForm = () => {
    setViewState("form");
  };

  const stayType = form.watch("stayType");
  const registrationFee = stayType === "on-campus" ? "₹15,000" : "₹7,500";
  const yearOptions = Array.from({ length: currentYear - 1929 }, (_, i) => currentYear - i);

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
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">
            Registration Form
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Register before 31st August 2026. Accommodation is on a first-come, first-serve basis
            with preference to alumni from older batches.
          </p>
          <div className="mt-4 inline-block bg-accent/20 text-accent-foreground px-4 py-2 rounded-lg border border-accent/30">
            <strong>Note:</strong> Currently accepting registrations for batches of {CUTOFF_YEAR} and earlier only.
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
              <ApplicationLookup onApplicationFound={handleApplicationFound} />
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                            <Input type="email" placeholder="your.email@example.com" {...field} className="bg-background" />
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

                  {/* Year of Passing */}
                  <FormField
                    control={form.control}
                    name="yearOfPassing"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-foreground">
                          <Calendar className="w-4 h-4 text-primary" />
                          Year of Passing (ISC/ICSE)
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
                              {isLookingUpPostalCode && (
                                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                              )}
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
                            <p className="text-xs text-muted-foreground">
                              City, district & state will auto-fill
                            </p>
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
                        <FormLabel className="text-foreground text-lg font-semibold">Registration Type</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="grid md:grid-cols-2 gap-4 mt-3"
                          >
                            <label className={`flex items-start gap-4 p-6 rounded-xl border-2 cursor-pointer transition-all ${
                              field.value === "on-campus" 
                                ? "border-primary bg-primary/5" 
                                : "border-border hover:border-primary/50"
                            }`}>
                              <RadioGroupItem value="on-campus" className="mt-1" />
                              <div>
                                <p className="font-semibold text-foreground">On Campus Stay</p>
                                <p className="text-2xl font-bold text-primary mt-1">₹15,000</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                  Includes accommodation, all meals & full event access
                                </p>
                              </div>
                            </label>
                            
                            <label className={`flex items-start gap-4 p-6 rounded-xl border-2 cursor-pointer transition-all ${
                              field.value === "outside" 
                                ? "border-primary bg-primary/5" 
                                : "border-border hover:border-primary/50"
                            }`}>
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
                              <SelectItem value="S">S (Chest: 36")</SelectItem>
                              <SelectItem value="M">M (Chest: 38-40")</SelectItem>
                              <SelectItem value="L">L (Chest: 42")</SelectItem>
                              <SelectItem value="XL">XL (Chest: 44")</SelectItem>
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
                              <SelectItem value="M">Male</SelectItem>
                              <SelectItem value="F">Female</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* reCAPTCHA Notice */}
                  <div className="text-xs text-muted-foreground text-center">
                    This site is protected by reCAPTCHA and the Google{" "}
                    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                      Privacy Policy
                    </a>{" "}
                    and{" "}
                    <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                      Terms of Service
                    </a>{" "}
                    apply.
                  </div>

                  {/* Submit */}
                  <div className="pt-6 border-t border-border">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="text-center md:text-left">
                        <p className="text-muted-foreground">Registration Fee</p>
                        <p className="text-3xl font-bold text-primary">{registrationFee}</p>
                      </div>
                      <Button 
                        type="submit" 
                        size="lg"
                        disabled={isSubmitting}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-12 py-6 text-lg rounded-full shadow-card hover:shadow-elevated transition-all"
                      >
                        {isSubmitting ? "Submitting..." : "Submit Registration"}
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
              onUpdatePayment={handleUpdatePayment}
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
