/**
 * applicationStorage.ts - Local Storage Utilities for Applications
 * 
 * LEGACY MODULE: This was used before Supabase integration for local-only storage.
 * Now primarily kept for backwards compatibility and potential offline scenarios.
 * 
 * The current application uses Supabase for persistent storage instead.
 * These utilities could be useful for:
 * - Offline form draft saving
 * - Caching application data locally
 * - Development/testing without database
 * 
 * Data Structure:
 * - Applications are stored as a Record<applicationId, ApplicationData>
 * - Each application has a unique ID in format ALM-{timestamp}-{random}
 * - Timestamps track creation and last update times
 */

/**
 * Interface for application data stored locally
 * Mirrors the structure used in the Supabase registrations table
 */
export interface ApplicationData {
  /** Unique application identifier (e.g., ALM-ABC123-XYZ) */
  applicationId: string;
  /** Applicant's full name */
  name: string;
  /** Applicant's email address */
  email: string;
  /** Applicant's phone number */
  phone: string;
  /** Applicant's current occupation */
  occupation: string;
  /** Year of passing from school */
  yearOfPassing: string;
  /** Full address (legacy field) */
  address: string;
  /** Type of stay: on-campus or outside */
  stayType: "on-campus" | "outside";
  /** T-shirt size selection */
  tshirtSize: "S" | "M" | "L" | "XL";
  /** Gender: Male or Female */
  gender: "M" | "F";
  /** Current payment status */
  paymentStatus: "pending" | "submitted";
  /** Payment reference number (optional) */
  paymentReference?: string;
  /** Date of payment (optional) */
  paymentDate?: string;
  /** ISO string of when application was created */
  createdAt: string;
  /** ISO string of when application was last modified */
  updatedAt: string;
}

/** localStorage key for storing applications */
const STORAGE_KEY = "alumni_registrations";

/**
 * Generates a unique application ID
 * 
 * Format: ALM-{timestamp_base36}-{random_4chars}
 * Example: ALM-M2X9KLP-A7B3
 * 
 * Using base36 for timestamp keeps it short while maintaining uniqueness.
 * The random suffix adds collision resistance for simultaneous creations.
 * 
 * @returns A unique application ID string
 */
export const generateApplicationId = (): string => {
  // Convert current timestamp to base36 (alphanumeric, shorter than decimal)
  const timestamp = Date.now().toString(36).toUpperCase();
  // Generate 4 random characters for additional uniqueness
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ALM-${timestamp}-${random}`;
};

/**
 * Retrieves all applications from localStorage
 * 
 * @returns Record of application ID to ApplicationData, or empty object
 */
export const getAllApplications = (): Record<string, ApplicationData> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    // If localStorage is unavailable or data is corrupted, return empty
    return {};
  }
};

/**
 * Saves a new application to localStorage
 * 
 * Automatically generates:
 * - applicationId
 * - createdAt timestamp
 * - updatedAt timestamp
 * 
 * @param data - Application data without auto-generated fields
 * @returns The complete ApplicationData with all fields populated
 */
export const saveApplication = (data: Omit<ApplicationData, "applicationId" | "createdAt" | "updatedAt">): ApplicationData => {
  const applications = getAllApplications();
  const applicationId = generateApplicationId();
  const now = new Date().toISOString();
  
  // Create complete application object
  const application: ApplicationData = {
    ...data,
    applicationId,
    createdAt: now,
    updatedAt: now,
  };
  
  // Store in the applications record
  applications[applicationId] = application;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
  
  return application;
};

/**
 * Retrieves a single application by its ID
 * 
 * @param applicationId - The application ID to look up
 * @returns The ApplicationData if found, null otherwise
 */
export const getApplicationById = (applicationId: string): ApplicationData | null => {
  const applications = getAllApplications();
  return applications[applicationId] || null;
};

/**
 * Updates payment details for an existing application
 * 
 * Sets:
 * - paymentStatus to "submitted"
 * - paymentReference to the provided value
 * - paymentDate to the provided value
 * - updatedAt to current timestamp
 * 
 * @param applicationId - The application to update
 * @param paymentReference - Transaction reference number
 * @param paymentDate - Date of payment
 * @returns Updated ApplicationData if found, null otherwise
 */
export const updatePaymentDetails = (
  applicationId: string, 
  paymentReference: string, 
  paymentDate: string
): ApplicationData | null => {
  const applications = getAllApplications();
  const application = applications[applicationId];
  
  if (!application) {
    return null;
  }
  
  // Update payment-related fields
  application.paymentStatus = "submitted";
  application.paymentReference = paymentReference;
  application.paymentDate = paymentDate;
  application.updatedAt = new Date().toISOString();
  
  // Save back to localStorage
  applications[applicationId] = application;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
  
  return application;
};
