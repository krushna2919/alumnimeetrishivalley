import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface EmailOtpVerificationProps {
  email: string;
  onVerified: () => void;
  isVerified: boolean;
  onEmailChange?: (email: string) => void;
  disabled?: boolean;
}

export function EmailOtpVerification({
  email,
  onVerified,
  isVerified,
  onEmailChange,
  disabled = false,
}: EmailOtpVerificationProps) {
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = useCallback(() => {
    setCooldown(30);
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendOtp = async () => {
    if (!email || email.trim().length === 0) {
      toast.error("Please enter your email address first");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { email: email.trim() },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setOtpSent(true);
      setOtp("");
      startCooldown();
      toast.success("Verification code sent!", {
        description: `Check your inbox at ${email}`,
      });
    } catch (err: any) {
      console.error("Send OTP error:", err);
      toast.error("Failed to send verification code. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter the complete 6-digit code");
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { email: email.trim(), otp },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        if (data.code === "OTP_EXPIRED") {
          setOtpSent(false);
          setOtp("");
        }
        return;
      }

      if (data?.verified) {
        onVerified();
        toast.success("Email verified successfully!");
      }
    } catch (err: any) {
      console.error("Verify OTP error:", err);
      toast.error("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  if (isVerified) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-green-800">Email Verified</p>
          <p className="text-xs text-green-600">{email}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!otpSent ? (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            {/* Email field is rendered by the parent form - this button sits beside it */}
          </div>
          <Button
            type="button"
            onClick={handleSendOtp}
            disabled={sending || disabled || !email || email.trim().length === 0}
            variant="outline"
            className="flex-shrink-0"
          >
            {sending ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-1 h-4 w-4" />
                Verify Email
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to <strong>{email}</strong>
          </p>
          <div className="flex items-center gap-3">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <Button
              type="button"
              onClick={handleVerifyOtp}
              disabled={verifying || otp.length !== 6}
              size="sm"
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Verify"
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSendOtp}
              disabled={cooldown > 0 || sending}
              className="text-xs"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setOtpSent(false);
                setOtp("");
              }}
              className="text-xs"
            >
              Change Email
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
