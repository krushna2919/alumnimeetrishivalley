import { z } from "zod";

export const CUTOFF_YEAR = 1980;
const currentYear = new Date().getFullYear();

// Schema for a single attendee
export const attendeeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number").max(15),
  occupation: z.string().min(2, "Please enter your occupation").max(100),
  yearOfPassing: z.string().refine((val) => {
    const year = parseInt(val);
    return year <= CUTOFF_YEAR && year >= 1930;
  }, `Registration is currently open only for batches of ${CUTOFF_YEAR} and earlier.`),
  stayType: z.enum(["on-campus", "outside"]),
  tshirtSize: z.enum(["S", "M", "L", "XL"]),
  gender: z.enum(["M", "F"]),
});

export type AttendeeData = z.infer<typeof attendeeSchema>;

// Schema for the main registrant (includes address)
export const registrantSchema = attendeeSchema.extend({
  addressLine1: z.string().min(5, "Please enter your street address").max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(2, "Please enter your city").max(100),
  district: z.string().min(2, "Please enter your district").max(100),
  state: z.string().min(2, "Please enter your state").max(100),
  postalCode: z.string().min(5, "Please enter a valid postal code").max(10),
  country: z.string().default("India"),
});

export type RegistrantData = z.infer<typeof registrantSchema>;

// Default values for new attendee
export const defaultAttendee: AttendeeData = {
  name: "",
  email: "",
  phone: "",
  occupation: "",
  yearOfPassing: "",
  stayType: "on-campus",
  tshirtSize: "" as AttendeeData["tshirtSize"],
  gender: "" as AttendeeData["gender"],
};

// Default values for main registrant
export const defaultRegistrant: RegistrantData = {
  ...defaultAttendee,
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  state: "",
  postalCode: "",
  country: "India",
};

export const MAX_ATTENDEES = 10;

export interface RegistrationData {
  applicationId: string;
  name: string;
  email: string;
  stayType: string;
  registrationFee: number;
  paymentStatus: string;
  createdAt: string;
}

// Calculate fee for stay type
export const calculateFee = (stayType: "on-campus" | "outside"): number => {
  return stayType === "on-campus" ? 15000 : 7500;
};

// Calculate total fee for all attendees
export const calculateTotalFee = (registrant: RegistrantData, attendees: AttendeeData[]): number => {
  const registrantFee = calculateFee(registrant.stayType);
  const attendeesFee = attendees.reduce((sum, a) => sum + calculateFee(a.stayType), 0);
  return registrantFee + attendeesFee;
};
