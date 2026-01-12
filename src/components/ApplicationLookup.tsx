import { useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getApplicationById, ApplicationData } from "@/lib/applicationStorage";

interface ApplicationLookupProps {
  onApplicationFound: (application: ApplicationData) => void;
}

const ApplicationLookup = ({ onApplicationFound }: ApplicationLookupProps) => {
  const [applicationId, setApplicationId] = useState("");
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleLookup = async () => {
    if (!applicationId.trim()) {
      setError("Please enter your Application ID");
      return;
    }

    setIsSearching(true);
    setError("");

    // Small delay for UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    const application = getApplicationById(applicationId.trim().toUpperCase());

    if (application) {
      onApplicationFound(application);
    } else {
      setError("Application not found. Please check your Application ID.");
    }

    setIsSearching(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-accent/20 backdrop-blur-sm rounded-2xl p-6 border border-accent/30 mb-8"
    >
      <h3 className="font-serif text-xl font-semibold text-foreground mb-4">
        Already Registered? Update Payment Details
      </h3>
      <p className="text-muted-foreground text-sm mb-4">
        Enter your Application ID to update your payment information
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Enter Application ID (e.g., ALM-XXXXX-XXXX)"
            value={applicationId}
            onChange={(e) => {
              setApplicationId(e.target.value.toUpperCase());
              setError("");
            }}
            className="bg-background uppercase"
          />
          {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        </div>
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
