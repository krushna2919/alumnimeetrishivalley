import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { attendeeSchema, AttendeeData, defaultAttendee, MAX_ATTENDEES } from "./types";
import AttendeeCard from "./AttendeeCard";

interface AdditionalAttendeesSectionProps {
  attendees: AttendeeData[];
  onAttendeesChange: (attendees: AttendeeData[]) => void;
  yearOptions: number[];
  primaryEmail: string;
}

const attendeesFormSchema = z.object({
  attendees: z.array(attendeeSchema),
});

type AttendeesFormData = z.infer<typeof attendeesFormSchema>;

const AdditionalAttendeesSection = ({ attendees, onAttendeesChange, yearOptions, primaryEmail }: AdditionalAttendeesSectionProps) => {
  const form = useForm<AttendeesFormData>({
    resolver: zodResolver(attendeesFormSchema),
    defaultValues: {
      attendees: attendees,
    },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "attendees",
  });

  const handleAddAttendee = () => {
    if (fields.length < MAX_ATTENDEES - 1) { // -1 because main registrant counts as 1
      append(defaultAttendee);
    }
  };

  const handleRemoveAttendee = (index: number) => {
    remove(index);
  };

  // Sync form values back to parent
  const watchedAttendees = form.watch("attendees");

  useEffect(() => {
    // Ensure parent always receives a new reference (RHF may mutate arrays in place)
    onAttendeesChange((watchedAttendees || []).map((a) => ({ ...a })));
  }, [onAttendeesChange, watchedAttendees]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg text-foreground">
            Additional Attendees
          </h3>
          <span className="text-sm text-muted-foreground">
            ({fields.length} of {MAX_ATTENDEES - 1} max)
          </span>
        </div>
        
        {fields.length < MAX_ATTENDEES - 1 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddAttendee}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Person
          </Button>
        )}
      </div>

      {fields.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-6 border-2 border-dashed border-border rounded-xl"
        >
          <Users className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Use the "Add Person" button above to register additional attendees
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            You can register up to {MAX_ATTENDEES} people (including yourself)
          </p>
        </motion.div>
      ) : (
        <Form {...form}>
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {fields.map((field, index) => (
                <AttendeeCard
                  key={field.id}
                  index={index}
                  form={form}
                  yearOptions={yearOptions}
                  primaryEmail={primaryEmail}
                  onRemove={() => handleRemoveAttendee(index)}
                  canRemove={true}
                />
              ))}
            </AnimatePresence>
          </div>
          
          {fields.length < MAX_ATTENDEES - 1 && fields.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleAddAttendee}
              className="w-full flex items-center justify-center gap-2 mt-4"
            >
              <Plus className="w-4 h-4" />
              Add Another Person ({fields.length + 1}/{MAX_ATTENDEES - 1})
            </Button>
          )}
        </Form>
      )}
    </div>
  );
};

export default AdditionalAttendeesSection;
