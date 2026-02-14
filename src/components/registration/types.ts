/**
 * types.ts - Registration Form Type Definitions and Validation Schemas
 * 
 * This module defines all type definitions and Zod validation schemas for
 * the registration form system. It includes:
 * 
 * 1. Validation Schemas (Zod)
 *    - attendeeSchema: For additional attendees in group registrations
 *    - registrantSchema: For the primary registrant (includes address)
 * 
 * 2. TypeScript Types (inferred from Zod)
 *    - AttendeeData: Type for additional attendees
 *    - RegistrantData: Type for main registrant
 *    - RegistrationData: API response type for registrations
 * 
 * 3. Default Values
 *    - defaultAttendee: Empty attendee template
 *    - defaultRegistrant: Empty registrant template
 * 
 * 4. Fee Calculation Utilities
 *    - calculateFee: Single person fee
 *    - calculateTotalFee: Group total fee
 * 
 * Validation Rules:
 * - Names: 2-100 characters
 * - Emails: Valid email format
 * - Phones: 10-15 characters
 * - Custom board requires name if "Other" selected
 * - Secondary email cannot match primary email
 */

import { z } from "zod";

/**
 * Schema for additional attendee data
 * 
 * Used for people registered by the primary registrant.
 * They share the primary registrant's email but can have
 * an optional secondary email for individual notifications.
 * 
 * Note: Year validation is done dynamically based on batch config,
 * so it's validated as a non-empty string here.
 */
export const attendeeSchema = z.object({
  /** Full name of the attendee */
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  /** Primary email (auto-populated from main registrant) */
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  /** Optional secondary email for individual notifications */
  secondaryEmail: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  /** Phone/WhatsApp number - must contain only digits, optional + prefix, 10-15 chars */
  phone: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number must be at most 15 digits")
    .regex(/^\+?[0-9]{10,15}$/, "Please enter a valid phone number (digits only, optional + prefix)"),
  /** Current occupation */
  occupation: z.string().min(2, "Please enter your occupation").max(100),
  /** Board type: ISC, ICSE, or Other */
  boardType: z.string().min(1, "Please select a board"),
  /** Custom board name when "Other" is selected */
  customBoardType: z.string().optional(),
  /** Year of passing (as string for select input) */
  yearOfPassing: z.string().min(1, "Please select a year of passing"),
  /** Accommodation preference */
  stayType: z.enum(["on-campus", "outside"]),
  /** T-shirt size with measurements */
  tshirtSize: z.enum(["S (Chest: 36\")", "M (Chest: 38-40\")", "L (Chest: 42\")", "XL (Chest: 44\")"]),
  /** Gender for accommodation assignment */
  gender: z.enum(["M", "F"]),
}).refine((data) => {
  // Custom validation: if boardType is "Other", customBoardType must be provided
  if (data.boardType === "Other" && (!data.customBoardType || data.customBoardType.trim().length < 2)) {
    return false;
  }
  return true;
}, {
  message: "Please enter your board name (at least 2 characters)",
  path: ["customBoardType"],
});

/** TypeScript type inferred from attendee schema */
export type AttendeeData = z.infer<typeof attendeeSchema>;

/**
 * Schema for the main/primary registrant
 * 
 * Extends attendee data with:
 * - Required email (primary contact for all notifications)
 * - Full address fields
 * - Array of additional attendees (group registration)
 * 
 * Additional Validation:
 * - Secondary emails of attendees cannot match primary email
 */
export const registrantSchema = z.object({
  /** Full name of the primary registrant */
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  /** Primary email - required for all communications */
  email: z.string().email("Please enter a valid email address").max(255),
  /** Phone/WhatsApp number - must contain only digits, optional + prefix, 10-15 chars */
  phone: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number must be at most 15 digits")
    .regex(/^\+?[0-9]{10,15}$/, "Please enter a valid phone number (digits only, optional + prefix)"),
  /** Current occupation */
  occupation: z.string().min(2, "Please enter your occupation").max(100),
  /** Board type: ISC, ICSE, or Other */
  boardType: z.string().min(1, "Please select a board"),
  /** Custom board name when "Other" is selected */
  customBoardType: z.string().optional(),
  /** Year of passing (as string for select input) */
  yearOfPassing: z.string().min(1, "Please select a year of passing"),
  /** Accommodation preference */
  stayType: z.enum(["on-campus", "outside"]),
  /** T-shirt size with measurements */
  tshirtSize: z.enum(["S (Chest: 36\")", "M (Chest: 38-40\")", "L (Chest: 42\")", "XL (Chest: 44\")"]),
  /** Gender for accommodation assignment */
  gender: z.enum(["M", "F"]),
  
  // Address fields (required for primary registrant)
  /** Street address - house/flat number, street name */
  addressLine1: z.string().min(5, "Please enter your street address").max(200),
  /** Optional second line - landmark, area */
  addressLine2: z.string().max(200).optional(),
  /** City or post office name */
  city: z.string().min(2, "Please enter your city").max(100),
  /** District name */
  district: z.string().min(2, "Please enter your district").max(100),
  /** State/province name */
  state: z.string().min(2, "Please enter your state").max(100),
  /** Postal/PIN code */
  postalCode: z.string().min(5, "Please enter a valid postal code").max(10),
  /** Country (defaults to India) */
  country: z.string().min(2, "Please enter your country").max(100),
  
  /** Additional attendees for group registration */
  attendees: z.array(attendeeSchema).default([]),
}).refine((data) => {
  // Custom validation: if boardType is "Other", customBoardType must be provided
  if (data.boardType === "Other" && (!data.customBoardType || data.customBoardType.trim().length < 2)) {
    return false;
  }
  return true;
}, {
  message: "Please enter your board name (at least 2 characters)",
  path: ["customBoardType"],
}).superRefine((data, ctx) => {
  // Validate that secondary emails don't match the primary email
  // This prevents confusion in email communications
  const primaryEmail = data.email.toLowerCase().trim();
  data.attendees.forEach((attendee, index) => {
    if (attendee.secondaryEmail && attendee.secondaryEmail.toLowerCase().trim() === primaryEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Secondary email cannot be the same as the primary registrant's email",
        path: ["attendees", index, "secondaryEmail"],
      });
    }
  });
});

/** TypeScript type inferred from registrant schema */
export type RegistrantData = z.infer<typeof registrantSchema>;

/**
 * Default values for a new attendee
 * Used when adding an attendee to the form
 */
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
  tshirtSize: "" as AttendeeData["tshirtSize"], // Cast needed for empty default
  gender: "" as AttendeeData["gender"],
};

/**
 * Default values for a new registrant
 * Used to initialize the registration form
 */
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
  country: "",
  attendees: [],
};

/**
 * Maximum number of additional attendees allowed per registration
 * Prevents abuse and ensures manageable group sizes
 */
export const MAX_ATTENDEES = 30;

/**
 * Registration data interface for API responses
 * Represents a registration record from the database
 */
export interface RegistrationData {
  /** Unique application identifier (ALM-XXXXX-XXXX format) */
  applicationId: string;
  /** Registrant's full name */
  name: string;
  /** Registrant's email address */
  email: string;
  /** Stay type: "on-campus" or "outside" */
  stayType: string;
  /** Registration fee in INR */
  registrationFee: number;
  /** Current payment status */
  paymentStatus: string;
  /** ISO timestamp of registration creation */
  createdAt: string;
  /** Parent application ID for group registrations (null for primary) */
  parentApplicationId?: string | null;
}

/**
 * Calculates the registration fee based on stay type
 * 
 * Fee Structure:
 * - On Campus: ₹15,000 (includes accommodation, all meals, event access)
 * - Outside: ₹7,500 (event access, lunch & dinner only)
 * 
 * @param stayType - The type of stay selected
 * @returns Fee amount in INR
 */
export const calculateFee = (stayType: "on-campus" | "outside"): number => {
  return stayType === "on-campus" ? 15000 : 7500;
};

/**
 * Calculates the total fee for a group registration
 * 
 * Sums the primary registrant's fee plus all additional attendees' fees.
 * Each person's fee is calculated independently based on their stay type.
 * 
 * @param registrant - Primary registrant data
 * @param attendees - Array of additional attendees
 * @returns Total fee in INR for all registrants
 */
export const calculateTotalFee = (registrant: RegistrantData, attendees: AttendeeData[]): number => {
  const registrantFee = calculateFee(registrant.stayType);
  const attendeesFee = attendees.reduce((sum, a) => sum + calculateFee(a.stayType), 0);
  return registrantFee + attendeesFee;
};
