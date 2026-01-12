import HeroSection from "@/components/HeroSection";
import RegistrationForm from "@/components/RegistrationForm";
import PaymentInfo from "@/components/PaymentInfo";
import ImportantNotes from "@/components/ImportantNotes";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <ImportantNotes />
      <PaymentInfo />
      <RegistrationForm />
      <Footer />
    </main>
  );
};

export default Index;
