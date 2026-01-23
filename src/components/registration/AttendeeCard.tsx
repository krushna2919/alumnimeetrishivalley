import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { RegistrantData, calculateFee } from "./types";
import { motion } from "framer-motion";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, Briefcase, Calendar, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AttendeeCardProps {
  index: number;
  form: UseFormReturn<RegistrantData>;
  onRemove: () => void;
  canRemove: boolean;
  yearOptions: number[];
  primaryEmail: string;
}

const AttendeeCard = ({ index, form, onRemove, canRemove, yearOptions, primaryEmail }: AttendeeCardProps) => {
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const attendeeName = form.watch(`attendees.${index}.name`) || `Attendee ${index + 1}`;
  const stayType = form.watch(`attendees.${index}.stayType`);
  const boardType = form.watch(`attendees.${index}.boardType`);
  const fee = calculateFee(stayType);

  const handleRemoveConfirm = () => {
    setShowRemoveDialog(false);
    onRemove();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-6 border border-border rounded-xl bg-muted/30"
    >
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-foreground">
          Additional Attendee {index + 1}
        </h4>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowRemoveDialog(true)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Remove
          </Button>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Attendee?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <span className="font-semibold text-foreground">"{attendeeName}"</span> from the registration? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="space-y-4">
        {/* Personal Details */}
        <div className="grid md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name={`attendees.${index}.name`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2 text-foreground">
                  <User className="w-4 h-4 text-primary" />
                  Full Name
                </FormLabel>
                <FormControl>
                  <Input placeholder="Enter full name" {...field} className="bg-background" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Primary Email - Read Only */}
          <FormItem>
            <FormLabel className="flex items-center gap-2 text-foreground">
              <Mail className="w-4 h-4 text-primary" />
              Email Address <span className="text-xs text-muted-foreground font-normal">(Primary Registrant)</span>
            </FormLabel>
            <Input 
              type="email" 
              value={primaryEmail} 
              disabled
              className="bg-muted text-muted-foreground cursor-not-allowed" 
            />
            <p className="text-xs text-muted-foreground mt-1">
              Same as the primary registrant's email address.
            </p>
          </FormItem>

          {/* Secondary Email - Optional */}
          <FormField
            control={form.control}
            name={`attendees.${index}.secondaryEmail`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2 text-foreground">
                  <Mail className="w-4 h-4 text-primary" />
                  Secondary Email <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                </FormLabel>
                <FormControl>
                  <Input 
                    type="email" 
                    placeholder="attendee@example.com" 
                    {...field} 
                    className="bg-background"
                    onBlur={(e) => {
                      field.onBlur();
                      const value = e.target.value.toLowerCase().trim();
                      if (value && value === primaryEmail.toLowerCase().trim()) {
                        form.setValue(`attendees.${index}.secondaryEmail`, "");
                        form.setError(`attendees.${index}.secondaryEmail`, {
                          type: "manual",
                          message: "Secondary email cannot be the same as the primary registrant's email"
                        });
                      }
                    }}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground mt-1">
                  If provided, this attendee will receive a separate confirmation email.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`attendees.${index}.phone`}
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
            name={`attendees.${index}.occupation`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2 text-foreground">
                  <Briefcase className="w-4 h-4 text-primary" />
                  Occupation
                </FormLabel>
                <FormControl>
                  <Input placeholder="Current profession" {...field} className="bg-background" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Board Type Selection */}
        <FormField
          control={form.control}
          name={`attendees.${index}.boardType`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground font-semibold">Board</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex flex-wrap gap-3 mt-2"
                >
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                    field.value === "ISC" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  }`}>
                    <RadioGroupItem value="ISC" />
                    <span className="font-medium text-foreground text-sm">ISC</span>
                  </label>
                  
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                    field.value === "ICSE" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  }`}>
                    <RadioGroupItem value="ICSE" />
                    <span className="font-medium text-foreground text-sm">ICSE</span>
                  </label>
                  
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                    field.value === "Other" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  }`}>
                    <RadioGroupItem value="Other" />
                    <span className="font-medium text-foreground text-sm">Other</span>
                  </label>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Custom Board Name Input - shown when "Other" is selected */}
        {boardType === "Other" && (
          <FormField
            control={form.control}
            name={`attendees.${index}.customBoardType`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">Board Name</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Enter board name" 
                    {...field} 
                    className="bg-background" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Year of Passing */}
        <FormField
          control={form.control}
          name={`attendees.${index}.yearOfPassing`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2 text-foreground">
                <Calendar className="w-4 h-4 text-primary" />
                Year of Passing
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select passing year" />
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

        {/* Stay Type */}
        <FormField
          control={form.control}
          name={`attendees.${index}.stayType`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground font-semibold">Registration Type</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="grid md:grid-cols-2 gap-3 mt-2"
                >
                  <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    field.value === "on-campus" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  }`}>
                    <RadioGroupItem value="on-campus" className="mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground text-sm">On Campus Stay</p>
                      <p className="text-lg font-bold text-primary">₹15,000</p>
                    </div>
                  </label>
                  
                  <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    field.value === "outside" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  }`}>
                    <RadioGroupItem value="outside" className="mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground text-sm">Staying Outside</p>
                      <p className="text-lg font-bold text-primary">₹7,500</p>
                    </div>
                  </label>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* T-Shirt & Gender */}
        <div className="grid md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name={`attendees.${index}.tshirtSize`}
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
                    <SelectItem value="S (Chest: 36&quot;)">S (Chest: 36")</SelectItem>
                    <SelectItem value="M (Chest: 38-40&quot;)">M (Chest: 38-40")</SelectItem>
                    <SelectItem value="L (Chest: 42&quot;)">L (Chest: 42")</SelectItem>
                    <SelectItem value="XL (Chest: 44&quot;)">XL (Chest: 44")</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`attendees.${index}.gender`}
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

        {/* Fee display */}
        <div className="pt-3 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Attendee Fee: <span className="font-semibold text-primary">₹{fee.toLocaleString()}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default AttendeeCard;
