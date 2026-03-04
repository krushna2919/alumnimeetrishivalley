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

const BATCH_CONFIG_CACHE_KEY = "batch_config_cache_v1";

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
  /** Whether to show the on-campus stay option */
  showStayOption: boolean;
  /** Whether to show the outside stay option */
  showOutsideOption: boolean;
}

interface BatchConfigurationRow {
  year_from: number;
  year_to: number;
  is_registration_open: boolean;
  registration_start_date: string | null;
  registration_end_date: string | null;
  show_stay_option: boolean;
  show_outside_option: boolean;
}

const toConfig = (row: BatchConfigurationRow): BatchConfiguration => ({
  yearFrom: row.year_from,
  yearTo: row.year_to,
  isRegistrationOpen: row.is_registration_open,
  registrationStartDate: row.registration_start_date,
  registrationEndDate: row.registration_end_date,
  showStayOption: row.show_stay_option,
  showOutsideOption: row.show_outside_option,
});

const getDefaultFallbackConfig = (): BatchConfiguration => {
  const currentYear = new Date().getFullYear();
  return {
    yearFrom: 1980,
    yearTo: currentYear,
    isRegistrationOpen: true,
    registrationStartDate: null,
    registrationEndDate: null,
    showStayOption: true,
    showOutsideOption: true,
  };
};

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
        let rpcData: BatchConfigurationRow[] | null = null;
        let lastError: unknown = null;

        // Retry transient network failures with small backoff
        for (let attempt = 1; attempt <= 3; attempt++) {
          const { data, error } = await supabase.rpc("get_open_batch_configuration");

          if (!error) {
            rpcData = data as BatchConfigurationRow[] | null;
            break;
          }

          lastError = error;
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 600));
          }
        }

        if (rpcData && rpcData.length > 0) {
          const liveConfig = toConfig(rpcData[0]);
          setConfig(liveConfig);
          setError(null);
          localStorage.setItem(BATCH_CONFIG_CACHE_KEY, JSON.stringify(liveConfig));
          return;
        }

        // If API returns no active config, fall back to cached/default so form stays usable
        const cachedConfigRaw = localStorage.getItem(BATCH_CONFIG_CACHE_KEY);
        if (cachedConfigRaw) {
          const cachedConfig = JSON.parse(cachedConfigRaw) as BatchConfiguration;
          setConfig(cachedConfig);
          setError(null);
          return;
        }

        setConfig(getDefaultFallbackConfig());
        setError(null);

        if (lastError) {
          console.error("Error fetching batch configuration:", lastError);
        }
      } catch (err) {
        console.error("Error fetching batch configuration:", err);

        // Last-resort resilience: keep form available with a safe fallback
        const cachedConfigRaw = localStorage.getItem(BATCH_CONFIG_CACHE_KEY);
        if (cachedConfigRaw) {
          const cachedConfig = JSON.parse(cachedConfigRaw) as BatchConfiguration;
          setConfig(cachedConfig);
          setError(null);
        } else {
          setConfig(getDefaultFallbackConfig());
          setError(null);
        }
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
    // Check if after end date - include the full end date in IST (UTC+5:30)
    // End of day in IST (23:59:59.999) = next day 18:29:59.999 UTC
    if (endDate) {
      const endOfDayIST = new Date(endDate);
      // Set to next day 18:30 UTC (= end of day 23:59:59 IST + buffer)
      endOfDayIST.setUTCDate(endOfDayIST.getUTCDate() + 1);
      endOfDayIST.setUTCHours(18, 30, 0, 0);
      if (now > endOfDayIST) return false;
    }
    
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
