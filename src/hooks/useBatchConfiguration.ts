/**
 * useBatchConfiguration.ts - Registration Batch Configuration Hook
 * 
 * Manages the dynamic configuration of registration batches/cohorts.
 * This hook fetches the current registration settings from the database
 * and provides computed values for form validation.
 * 
 * Configuration Fields:
 * - yearFrom: Earliest graduation year eligible for registration
 * - yearTo: Latest graduation year eligible for registration
 * - isRegistrationOpen: Master toggle for registration availability
 * - registrationStartDate: When registration opens
 * - registrationEndDate: When registration closes
 * 
 * This allows admins to control:
 * - Which batches can register (phased rollout)
 * - When registration is available
 * - The pool of valid graduation years in the form
 * 
 * @example
 * ```tsx
 * const { config, yearOptions, isWithinRegistrationPeriod } = useBatchConfiguration();
 * 
 * if (!isWithinRegistrationPeriod()) {
 *   return <RegistrationClosed />;
 * }
 * ```
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Interface for batch configuration data
 */
interface BatchConfiguration {
  /** Earliest graduation year eligible */
  yearFrom: number;
  /** Latest graduation year eligible */
  yearTo: number;
  /** Master toggle for registration */
  isRegistrationOpen: boolean;
  /** Start date for registration period (ISO string or null) */
  registrationStartDate: string | null;
  /** End date for registration period (ISO string or null) */
  registrationEndDate: string | null;
}

/**
 * useBatchConfiguration Hook
 * 
 * Fetches and manages the current registration batch configuration.
 * Uses a database RPC function to get the currently active configuration.
 * 
 * @returns Object containing:
 * - config: The batch configuration object (or null if loading/error)
 * - yearOptions: Array of valid graduation years for the form dropdown
 * - isLoading: True while fetching configuration
 * - error: Error message if fetch failed
 * - isWithinRegistrationPeriod: Function to check if current time is valid
 */
export const useBatchConfiguration = () => {
  // State for configuration data
  const [config, setConfig] = useState<BatchConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch configuration on mount
   */
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Call the database function that returns the open batch configuration
        // This is a SECURITY DEFINER function that bypasses RLS
        const { data, error } = await supabase.rpc("get_open_batch_configuration");

        if (error) {
          console.error("Error fetching batch configuration:", error);
          setError("Unable to load registration configuration");
          return;
        }

        // Check if we got configuration data
        if (data && data.length > 0) {
          const configData = data[0];
          // Transform snake_case database columns to camelCase
          setConfig({
            yearFrom: configData.year_from,
            yearTo: configData.year_to,
            isRegistrationOpen: configData.is_registration_open,
            registrationStartDate: configData.registration_start_date,
            registrationEndDate: configData.registration_end_date,
          });
        } else {
          // No configuration found - registration not set up
          setError("No registration configuration found");
        }
      } catch (err) {
        console.error("Error fetching batch configuration:", err);
        setError("Unable to load registration configuration");
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  /**
   * Generate array of valid graduation years for the form dropdown
   * Years are returned in descending order (newest first)
   * 
   * Example: if yearFrom=1980 and yearTo=2020
   * Returns: [2020, 2019, 2018, ..., 1981, 1980]
   */
  const yearOptions = config
    ? Array.from(
        { length: config.yearTo - config.yearFrom + 1 },
        (_, i) => config.yearTo - i  // Descending order
      )
    : [];

  /**
   * Checks if the current date/time is within the registration period
   * 
   * Logic:
   * - If no config, return false
   * - If no start/end dates are set, return true (only isRegistrationOpen matters)
   * - Otherwise, check if current time is between start and end dates
   * 
   * @returns Boolean indicating if registration is currently allowed
   */
  const isWithinRegistrationPeriod = (): boolean => {
    if (!config) return false;
    
    const now = new Date();
    const startDate = config.registrationStartDate ? new Date(config.registrationStartDate) : null;
    const endDate = config.registrationEndDate ? new Date(config.registrationEndDate) : null;
    
    // If no dates are set, allow submission (only isRegistrationOpen matters)
    if (!startDate && !endDate) return true;
    
    // Check if before start date
    if (startDate && now < startDate) return false;
    // Check if after end date
    if (endDate && now > endDate) return false;
    
    return true;
  };

  return {
    config,
    yearOptions,
    isLoading,
    error,
    isWithinRegistrationPeriod,
  };
};
