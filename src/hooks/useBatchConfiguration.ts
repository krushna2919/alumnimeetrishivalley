import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BatchConfiguration {
  yearFrom: number;
  yearTo: number;
  isRegistrationOpen: boolean;
  registrationStartDate: string | null;
  registrationEndDate: string | null;
}

export const useBatchConfiguration = () => {
  const [config, setConfig] = useState<BatchConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase.rpc("get_open_batch_configuration");

        if (error) {
          console.error("Error fetching batch configuration:", error);
          setError("Unable to load registration configuration");
          return;
        }

        if (data && data.length > 0) {
          const configData = data[0];
          setConfig({
            yearFrom: configData.year_from,
            yearTo: configData.year_to,
            isRegistrationOpen: configData.is_registration_open,
            registrationStartDate: configData.registration_start_date,
            registrationEndDate: configData.registration_end_date,
          });
        } else {
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

  // Generate year options based on config
  const yearOptions = config
    ? Array.from(
        { length: config.yearTo - config.yearFrom + 1 },
        (_, i) => config.yearTo - i
      )
    : [];

  return {
    config,
    yearOptions,
    isLoading,
    error,
  };
};
