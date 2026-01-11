import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, Briefcase, MapPin, Calendar } from "lucide-react";

const currentYear = new Date().getFullYear();
const CUTOFF_YEAR = 1980; // Only batches up to 1980 can register currently

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number").max(15),
  occupation: z.string().min(2, "Please enter your occupation").max(100),
  yearOfPassing: z.string().refine((val) => {
    const year = parseInt(val);
    return year <= CUTOFF_YEAR && year >= 1930;
  }, `Registration is currently open only for batches of ${CUTOFF_YEAR} and earlier. Please wait for registration to open for your batch.`),
  address: z.string().min(10, "Please enter your complete address").max(500),
  stayType: z.enum(["on-campus", "outside"]),
  tshirtSize: z.enum(["S", "M", "L", "XL"]),
  gender: z.enum(["M", "F"]),
});

type FormData = z.infer<typeof formSchema>;

const RegistrationForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      occupation: "",
      yearOfPassing: "",
      address: "",
      stayType: "on-campus",
      tshirtSize: "M",
      gender: "M",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    // Simulate submission
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    console.log("Registration Data:", data);
    toast.success("Registration submitted successfully!", {
      description: "Please proceed with the payment and email confirmation.",
    });
    
    setIsSubmitting(false);
  };

  const stayType = form.watch("stayType");
  const registrationFee = stayType === "on-campus" ? "₹15,000" : "₹7,500";

  // Generate year options from 1930 to current year
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

              {/* Address */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-foreground">
                      <MapPin className="w-4 h-4 text-primary" />
                      Full Address
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter your complete address" 
                        {...field} 
                        className="bg-background min-h-[100px]" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
        </motion.div>
      </div>
    </section>
  );
};

export default RegistrationForm;
