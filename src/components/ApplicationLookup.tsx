/**
 * ApplicationLookup.tsx - Existing Registration Lookup Component
 * 
 * Allows users who have already registered to look up their application
 * by entering their Application ID. This is useful for:
 * - Updating payment information
 * - Checking registration status
 * - Re-uploading payment proof
 * 
 * Features:
 * - Auto-uppercase input for Application IDs
 * - Real-time validation feedback
 * - Loading state during search
 * - Error handling for not-found cases
 * 
 * Integration:
 * - Queries Supabase 'registrations' table
 * - Returns application data to parent via callback
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RegistrationData } from "./registration/types";

/**
 * Props interface for ApplicationLookup
 */
interface ApplicationLookupProps {
  /** Callback function called when an application is successfully found */
  onApplicationFound: (application: RegistrationData) => void;
}

/**
 * ApplicationLookup Component
 * 
 * Provides a search interface for existing registrants to find their application.
 * 
 * @param onApplicationFound - Callback with application data when found
 * @returns Search form with input and button
 */
const ApplicationLookup = ({ onApplicationFound }: ApplicationLookupProps) => {
  // Local state for form handling
  const [applicationId, setApplicationId] = useState("");
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  /**
   * Handles the lookup request
   * 
   * Workflow:
   * 1. Validate input is not empty
   * 2. Query Supabase for matching application
   * 3. Transform database response to RegistrationData format
   * 4. Call parent callback with result or show error
   */
  const handleLookup = async () => {
    // Validate input
    if (!applicationId.trim()) {
      setError("Please enter your Application ID");
      return;
    }

    setIsSearching(true);
    setError("");

    try {
      // Query the registrations table by application_id
      // We select specific fields needed for the payment update flow
      const { data: application, error: fetchError } = await supabase
        .from("registrations")
        .select("application_id, name, email, stay_type, registration_fee, payment_status, created_at, parent_application_id")
        .eq("application_id", applicationId.trim().toUpperCase())
        .single(); // Expect exactly one result

      // Handle not found case
      if (fetchError || !application) {
        setError("Application not found. Please check your Application ID.");
        setIsSearching(false);
        return;
      }

      // Transform database column names (snake_case) to TypeScript format (camelCase)
      onApplicationFound({
        applicationId: application.application_id,
        name: application.name,
        email: application.email,
        stayType: application.stay_type,
        registrationFee: application.registration_fee,
        paymentStatus: application.payment_status,
        createdAt: application.created_at,
        parentApplicationId: application.parent_application_id,
      });
    } catch (err) {
      console.error("Lookup error:", err);
      setError("An error occurred. Please try again.");
    }

    setIsSearching(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-accent/20 backdrop-blur-sm rounded-2xl p-6 border border-accent/30 mb-8"
    >
      {/* Section header */}
      <h3 className="font-serif text-xl font-semibold text-foreground mb-4">
        Already Registered? Update Payment Details
      </h3>
      <p className="text-muted-foreground text-sm mb-4">
        Enter your Application ID to update your payment information
      </p>
      
      {/* Search form - responsive flex layout */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          {/* Application ID input with auto-uppercase */}
          <Input
            placeholder="Enter Application ID (e.g., ALM-XXXXX-XXXX)"
            value={applicationId}
            onChange={(e) => {
              // Convert to uppercase for consistency
              setApplicationId(e.target.value.toUpperCase());
              setError(""); // Clear error on input change
            }}
            className="bg-background uppercase"
          />
          {/* Error message display */}
          {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        </div>
        
        {/* Search button with loading state */}
        <Button
          onClick={handleLookup}
          disabled={isSearching}
          className="bg-primary hover:bg-primary/90"
        >
          <Search className="w-4 h-4 mr-2" />
          {isSearching ? "Searching..." : "Find Application"}
        </Button>
      </div>
    </motion.div>
  );
};

export default ApplicationLookup;
