/**
 * useHoneypot.ts - Bot Protection Hook (No External Dependencies)
 * 
 * A lightweight, zero-dependency anti-bot solution that combines:
 * 1. Honeypot field detection - Hidden field that bots fill but humans don't see
 * 2. Time-based validation - Form submissions that are too fast are likely automated
 * 
 * Advantages over reCAPTCHA:
 * - No external script loading (faster page load)
 * - No user friction (no puzzles to solve)
 * - Works offline and in restricted networks
 * - GDPR-friendly (no third-party data sharing)
 * 
 * How it works:
 * 1. Records timestamp when form loads
 * 2. Provides a hidden field that legitimate users never see/fill
 * 3. On submit, calculates time difference and checks honeypot
 * 4. Sends validation data to server for final verification
 * 
 * Server-side validation is still required for security.
 * 
 * @example
 * ```tsx
 * const { setHoneypotValue, getValidationData, isLikelyBot } = useHoneypot();
 * 
 * // In form:
 * <input type="hidden" onChange={(e) => setHoneypotValue(e.target.value)} />
 * 
 * // On submit:
 * if (isLikelyBot()) return; // Quick client-side check
 * const botValidation = getValidationData();
 * // Send botValidation to server
 * ```
 */

import { useRef, useCallback } from "react";

/**
 * useHoneypot Hook
 * 
 * Provides bot detection functionality using honeypot and timing techniques.
 * 
 * @returns Object with:
 * - resetFormLoadTime: Call when form becomes visible (for SPAs with cached forms)
 * - setHoneypotValue: Callback for hidden field's onChange
 * - getValidationData: Returns data object to send to server
 * - isLikelyBot: Quick client-side bot check (for immediate feedback)
 */
export const useHoneypot = () => {
  /**
   * Timestamp when the form was loaded
   * Used to calculate how long the user took to fill out the form
   */
  const formLoadTimeRef = useRef<number>(Date.now());
  
  /**
   * Value of the honeypot field
   * Should remain empty for legitimate users
   */
  const honeypotFieldRef = useRef<string>("");

  /**
   * Resets the form load time
   * Call this when the form becomes visible (e.g., after navigation)
   * This prevents false positives for users who navigate to the form later
   */
  const resetFormLoadTime = useCallback(() => {
    formLoadTimeRef.current = Date.now();
  }, []);

  /**
   * Sets the honeypot field value
   * This should be called by a hidden input's onChange handler
   * 
   * @param value - The value entered in the honeypot field
   */
  const setHoneypotValue = useCallback((value: string) => {
    honeypotFieldRef.current = value;
  }, []);

  /**
   * Gets validation data to send to the server
   * The server should perform the actual validation
   * 
   * @returns Object with honeypot value and timing information
   */
  const getValidationData = useCallback(() => {
    return {
      honeypot: honeypotFieldRef.current,
      formLoadTime: formLoadTimeRef.current,
      submitTime: Date.now(),
    };
  }, []);

  /**
   * Quick client-side bot detection
   * 
   * Checks two conditions:
   * 1. Form filled in less than 3 seconds (too fast for humans)
   * 2. Honeypot field has a value (bots fill all visible fields)
   * 
   * Note: This is for immediate feedback only.
   * Server-side validation is still required for security.
   * 
   * @returns True if the submission appears to be from a bot
   */
  const isLikelyBot = useCallback(() => {
    const timeDiff = Date.now() - formLoadTimeRef.current;
    
    // If form filled in less than 3 seconds, likely a bot
    const tooFast = timeDiff < 3000;
    
    // If honeypot field has value, it's definitely a bot
    // (CSS-hidden fields are invisible to users but bots fill everything)
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
