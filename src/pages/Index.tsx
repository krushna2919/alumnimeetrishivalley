/**
 * Index.tsx - Main Landing Page
 * 
 * This is the public-facing landing page for the Rishi Valley Alumni Meet 2026.
 * It serves as the entry point for alumni to learn about the event and register.
 * 
 * Page Structure (top to bottom):
 * 1. HeroSection - Eye-catching banner with event title and date
 * 2. ImportantNotes - Key information alumni need to know before registering
 * 3. PaymentInfo - Bank details and QR code for payment
 * 4. RegistrationForm - The main form for alumni to submit their registration
 *    - OR RegistrationFormLegacy for 1930-1980 alumni (via #register1930-1980)
 * 5. Footer - Contact information and event details
 * 
 * Hash-based Routing:
 * - Default (#register or no hash): Standard registration form
 * - #register1930-1980: Legacy registration form for 1930-1980 batches
 */

import { useState, useEffect } from "react";
import HeroSection from "@/components/HeroSection";
import RegistrationForm from "@/components/RegistrationForm";
import RegistrationFormLegacy from "@/components/RegistrationFormLegacy";
import PaymentInfo from "@/components/PaymentInfo";
import ImportantNotes from "@/components/ImportantNotes";
import Footer from "@/components/Footer";

/**
 * Index Component
 * 
 * Composes the main landing page from modular section components.
 * Uses hash-based routing to show either the standard or legacy form.
 * 
 * @returns The complete landing page layout
 */
const Index = ({ forceLegacy = false }: { forceLegacy?: boolean }) => {
  const [showLegacyForm, setShowLegacyForm] = useState(forceLegacy);

  useEffect(() => {
    if (forceLegacy) {
      setShowLegacyForm(true);
      return;
    }

    // Check initial hash
    const checkHash = () => {
      const hash = window.location.hash;
      setShowLegacyForm(hash === "#register1930-1980");
    };

    // Check on mount
    checkHash();

    // Listen for hash changes
    window.addEventListener("hashchange", checkHash);
    return () => window.removeEventListener("hashchange", checkHash);
  }, [forceLegacy]);

  return (
    <main className="min-h-screen">
      {/* Hero banner with event branding and call-to-action */}
      <HeroSection registerHref={showLegacyForm ? "#register1930-1980" : "#register"} />
      
      {/* Important information about eligibility, deadlines, etc. */}
      <ImportantNotes />
      
      {/* Payment methods: bank transfer and UPI QR code */}
      <PaymentInfo />
      
      {/* Registration form - show legacy or standard based on hash */}
      {showLegacyForm ? <RegistrationFormLegacy /> : <RegistrationForm />}
      
      {/* Footer with contact info and event details */}
      <Footer />
    </main>
  );
};

export default Index;
