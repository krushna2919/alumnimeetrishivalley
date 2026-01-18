import { z } from "zod";

// Schema for a single attendee - year validation is done dynamically based on batch config
// email is auto-populated from primary registrant (stored but not editable)
// secondaryEmail is optional - if provided, attendee receives their own confirmation email
export const attendeeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  secondaryEmail: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  phone: z.string().min(10, "Please enter a valid phone number").max(15),
  occupation: z.string().min(2, "Please enter your occupation").max(100),
  boardType: z.string().min(1, "Please select a board"),
  customBoardType: z.string().optional(),
  yearOfPassing: z.string().min(1, "Please select a year of passing"),
  stayType: z.enum(["on-campus", "outside"]),
  tshirtSize: z.enum(["S (Chest: 36\")", "M (Chest: 38-40\")", "L (Chest: 42\")", "XL (Chest: 44\")"]),
  gender: z.enum(["M", "F"]),
}).refine((data) => {
  if (data.boardType === "Other" && (!data.customBoardType || data.customBoardType.trim().length < 2)) {
    return false;
  }
  return true;
}, {
  message: "Please enter your board name (at least 2 characters)",
  path: ["customBoardType"],
});

export type AttendeeData = z.infer<typeof attendeeSchema>;

// Schema for the main registrant (includes address, email is required)
export const registrantSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number").max(15),
  occupation: z.string().min(2, "Please enter your occupation").max(100),
  boardType: z.string().min(1, "Please select a board"),
  customBoardType: z.string().optional(),
  yearOfPassing: z.string().min(1, "Please select a year of passing"),
  stayType: z.enum(["on-campus", "outside"]),
  tshirtSize: z.enum(["S (Chest: 36\")", "M (Chest: 38-40\")", "L (Chest: 42\")", "XL (Chest: 44\")"]),
  gender: z.enum(["M", "F"]),
  addressLine1: z.string().min(5, "Please enter your street address").max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(2, "Please enter your city").max(100),
  district: z.string().min(2, "Please enter your district").max(100),
  state: z.string().min(2, "Please enter your state").max(100),
  postalCode: z.string().min(5, "Please enter a valid postal code").max(10),
  country: z.string().default("India"),
}).refine((data) => {
  if (data.boardType === "Other" && (!data.customBoardType || data.customBoardType.trim().length < 2)) {
    return false;
  }
  return true;
}, {
  message: "Please enter your board name (at least 2 characters)",
  path: ["customBoardType"],
});

export type RegistrantData = z.infer<typeof registrantSchema>;

// Default values for new attendee
export const defaultAttendee: AttendeeData = {
  name: "",
  email: "",
  secondaryEmail: "",
  phone: "",
  occupation: "",
  boardType: "",
  customBoardType: "",
  yearOfPassing: "",
  stayType: "on-campus",
  tshirtSize: "" as AttendeeData["tshirtSize"],
  gender: "" as AttendeeData["gender"],
};

// Default values for main registrant
export const defaultRegistrant: RegistrantData = {
  ...defaultAttendee,
  boardType: "",
  customBoardType: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  state: "",
  postalCode: "",
  country: "India",
};

export const MAX_ATTENDEES = 30;

export interface RegistrationData {
  applicationId: string;
  name: string;
  email: string;
  stayType: string;
  registrationFee: number;
  paymentStatus: string;
  createdAt: string;
  parentApplicationId?: string | null;
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
