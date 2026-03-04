import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, Clock } from "lucide-react";
import HeroSection from "@/components/HeroSection";
import RegistrationForm from "@/components/RegistrationForm";
import PaymentInfo from "@/components/PaymentInfo";
import Footer from "@/components/Footer";

interface InviteData {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  used: boolean;
}

const InviteRegistration = () => {
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Invalid invite link.");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("registration_invites" as any)
        .select("id, email, token, expires_at, used")
        .eq("token", token)
        .single();

      if (fetchError || !data) {
        setError("This invite link is invalid or has been removed.");
        setLoading(false);
        return;
      }

      const inviteData = data as any as InviteData;

      if (inviteData.used) {
        setError("This invite link has already been used.");
        setLoading(false);
        return;
      }

      if (new Date(inviteData.expires_at) < new Date()) {
        setError("This invite link has expired. Please contact the administrator to request a new link or extension.");
        setLoading(false);
        return;
      }

      setInvite(inviteData);
      setLoading(false);
    };

    validateToken();
  }, [token]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-muted-foreground">Validating your invite...</span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="font-serif text-2xl font-bold text-foreground mb-3">Invite Not Valid</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!invite) return null;

  const expiresAt = new Date(invite.expires_at);
  const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));

  return (
    <main className="min-h-screen">
      <HeroSection registerHref="#register" />

      {/* Invite info banner */}
      <div className="bg-accent/20 border-b border-accent/30">
        <div className="container max-w-4xl px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-accent-foreground">
            <Clock className="w-4 h-4" />
            <span>
              Invited registration for <strong>{invite.email}</strong> · 
              Expires in ~{hoursLeft} hour{hoursLeft !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <PaymentInfo />

      <RegistrationForm
        singleAttendeeOnly
        inviteToken={token}
        inviteEmail={invite.email}
      />

      <Footer />
    </main>
  );
};

export default InviteRegistration;
