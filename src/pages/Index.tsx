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
 * 5. Footer - Contact information and event details
 * 
 * Design Philosophy:
 * - Mobile-first responsive design
 * - Clear visual hierarchy guiding users through the registration process
 * - Warm, inviting color palette reflecting the school's heritage
 */

import HeroSection from "@/components/HeroSection";
import RegistrationForm from "@/components/RegistrationForm";
import PaymentInfo from "@/components/PaymentInfo";
import ImportantNotes from "@/components/ImportantNotes";
import Footer from "@/components/Footer";

/**
 * Index Component
 * 
 * Composes the main landing page from modular section components.
 * Each section is a self-contained component for maintainability.
 * 
 * @returns The complete landing page layout
 */
const Index = () => {
  return (
    <main className="min-h-screen">
      {/* Hero banner with event branding and call-to-action */}
      <HeroSection />
      
      {/* Important information about eligibility, deadlines, etc. */}
      <ImportantNotes />
      
      {/* Payment methods: bank transfer and UPI QR code */}
      <PaymentInfo />
      
      {/* Main registration form with application lookup */}
      <RegistrationForm />
      
      {/* Footer with contact info and event details */}
      <Footer />
    </main>
  );
};

export default Index;
