/**
 * PublicLanding.tsx - Gatekeeper for the public root route.
 *
 * Decides at runtime whether to show the full registration landing page
 * (Index) or the "Registrations Closed" page, based on the active batch
 * configuration. This ensures the "Proceed to Registration" CTA and the
 * registration form are only shown while registrations are actually open.
 *
 * Silent registration via private invite links (/invite/:token) is NOT
 * affected — those bypass this gate entirely (handled in App.tsx routing
 * + RegistrationForm's `inviteToken` bypass of `isWithinRegistrationPeriod`).
 */

import { Loader2 } from "lucide-react";
import { useBatchConfiguration } from "@/hooks/useBatchConfiguration";
import Index from "./Index";
import RegistrationsClosed from "./RegistrationsClosed";

interface PublicLandingProps {
  yearFromOverride?: number;
  yearToOverride?: number;
  forceOutsideOnly?: boolean;
}

const PublicLanding = ({ yearFromOverride, yearToOverride, forceOutsideOnly }: PublicLandingProps) => {
  const { config, isLoading, isWithinRegistrationPeriod } = useBatchConfiguration();

  // While the configuration is loading, show a lightweight loader instead of
  // briefly flashing either landing page.
  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  // Registration is "open" only when the master toggle is on AND the current
  // time falls within the configured window.
  const isOpen = !!config?.isRegistrationOpen && isWithinRegistrationPeriod();

  if (!isOpen) {
    return <RegistrationsClosed />;
  }

  return (
    <Index
      yearFromOverride={yearFromOverride}
      yearToOverride={yearToOverride}
      forceOutsideOnly={forceOutsideOnly}
    />
  );
};

export default PublicLanding;
