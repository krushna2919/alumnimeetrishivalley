import { useState, useCallback } from "react";

interface PostalCodeData {
  city: string;
  district: string;
  state: string;
}

interface PostOffice {
  Name: string;
  District: string;
  State: string;
}

interface PostalAPIResponse {
  Status: string;
  PostOffice: PostOffice[] | null;
}

export const usePostalCodeLookup = () => {
  const [isLoading, setIsLoading] = useState(false);

  const lookupPostalCode = useCallback(async (pincode: string): Promise<PostalCodeData | null> => {
    // Validate PIN code format (6 digits for India)
    if (!/^\d{6}$/.test(pincode)) {
      return null;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data: PostalAPIResponse[] = await response.json();

      if (data[0]?.Status === "Success" && data[0]?.PostOffice && data[0].PostOffice.length > 0) {
        const postOffice = data[0].PostOffice[0];
        return {
          city: postOffice.Name,
          district: postOffice.District,
          state: postOffice.State,
        };
      }

      return null;
    } catch (error) {
      console.error("Error fetching postal code data:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { lookupPostalCode, isLoading };
};
