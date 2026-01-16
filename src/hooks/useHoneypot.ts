import { useRef, useCallback } from "react";

/**
 * Honeypot bot protection hook
 * - Hidden field that bots fill but humans don't see
 * - Time-based validation (submissions too fast are likely bots)
 * - No external dependencies, zero loading time
 */
export const useHoneypot = () => {
  const formLoadTimeRef = useRef<number>(Date.now());
  const honeypotFieldRef = useRef<string>("");

  // Reset the form load time (call when form becomes visible)
  const resetFormLoadTime = useCallback(() => {
    formLoadTimeRef.current = Date.now();
  }, []);

  // Set honeypot value (called by hidden field onChange)
  const setHoneypotValue = useCallback((value: string) => {
    honeypotFieldRef.current = value;
  }, []);

  // Get validation data to send to server
  const getValidationData = useCallback(() => {
    return {
      honeypot: honeypotFieldRef.current,
      formLoadTime: formLoadTimeRef.current,
      submitTime: Date.now(),
    };
  }, []);

  // Client-side quick check (server does the real validation)
  const isLikelyBot = useCallback(() => {
    const timeDiff = Date.now() - formLoadTimeRef.current;
    // If form filled in less than 3 seconds, likely a bot
    const tooFast = timeDiff < 3000;
    // If honeypot field has value, it's a bot
    const honeypotFilled = honeypotFieldRef.current.length > 0;
    
    return tooFast || honeypotFilled;
  }, []);

  return {
    resetFormLoadTime,
    setHoneypotValue,
    getValidationData,
    isLikelyBot,
  };
};
