// Application storage utilities using localStorage

export interface ApplicationData {
  applicationId: string;
  name: string;
  email: string;
  phone: string;
  occupation: string;
  yearOfPassing: string;
  address: string;
  stayType: "on-campus" | "outside";
  tshirtSize: "S" | "M" | "L" | "XL";
  gender: "M" | "F";
  paymentStatus: "pending" | "submitted";
  paymentReference?: string;
  paymentDate?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "alumni_registrations";

// Generate a unique application ID
export const generateApplicationId = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ALM-${timestamp}-${random}`;
};

// Get all applications from localStorage
export const getAllApplications = (): Record<string, ApplicationData> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

// Save a new application
export const saveApplication = (data: Omit<ApplicationData, "applicationId" | "createdAt" | "updatedAt">): ApplicationData => {
  const applications = getAllApplications();
  const applicationId = generateApplicationId();
  const now = new Date().toISOString();
  
  const application: ApplicationData = {
    ...data,
    applicationId,
    createdAt: now,
    updatedAt: now,
  };
  
  applications[applicationId] = application;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
  
  return application;
};

// Get application by ID
export const getApplicationById = (applicationId: string): ApplicationData | null => {
  const applications = getAllApplications();
  return applications[applicationId] || null;
};

// Update payment details for an application
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
  
  application.paymentStatus = "submitted";
  application.paymentReference = paymentReference;
  application.paymentDate = paymentDate;
  application.updatedAt = new Date().toISOString();
  
  applications[applicationId] = application;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
  
  return application;
};
