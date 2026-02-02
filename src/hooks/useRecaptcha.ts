/**
 * useRecaptcha.ts - Google reCAPTCHA v3 Integration Hook
 * 
 * NOTE: This hook is currently NOT USED in the application.
 * The application uses useHoneypot for bot protection instead,
 * which provides a simpler, zero-dependency solution.
 * 
 * This hook remains for potential future use if stronger bot
 * protection is needed. reCAPTCHA v3 provides:
 * - Invisible verification (no user interaction)
 * - Risk scoring for each action
 * - Machine learning-based bot detection
 * 
 * Considerations:
 * - Requires Google account and API setup
 * - Adds external script dependency (~100KB)
 * - May be blocked by ad-blockers or firewalls
 * - GDPR compliance considerations
 * 
 * @deprecated Currently unused - see useHoneypot.ts
 */

import { useEffect, useCallback } from "react";

// reCAPTCHA v3 Site Key - replace with actual key if re-enabled
const RECAPTCHA_SITE_KEY = "6LchWkgsAAAAAIWpNxur7VomXXyOQVuy9eoDUD3d";

/**
 * Extend Window interface to include grecaptcha
 */
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

/** Singleton promise to prevent multiple script loads */
let recaptchaLoadPromise: Promise<void> | null = null;

/**
 * Dynamically loads the reCAPTCHA script
 * 
 * Features:
 * - Singleton pattern prevents duplicate loading
 * - Fallback to recaptcha.net if google.com is blocked
 * - 10-second timeout for network issues
 * - Graceful error handling
 * 
 * @param siteKey - reCAPTCHA site key
 * @returns Promise that resolves when script is ready
 */
function loadRecaptcha(siteKey: string): Promise<void> {
  // If already available, we're done
  if (window.grecaptcha && typeof window.grecaptcha.ready === "function") {
    return Promise.resolve();
  }

  // Return existing promise if loading is in progress
  if (recaptchaLoadPromise) return recaptchaLoadPromise;

  recaptchaLoadPromise = new Promise<void>((resolve, reject) => {
    // Try google.com first, fallback to recaptcha.net for China/restricted networks
    const sources = [
      `https://www.google.com/recaptcha/api.js?render=${siteKey}`,
      `https://www.recaptcha.net/recaptcha/api.js?render=${siteKey}`,
    ];

    // Check for existing script tag
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://www.google.com/recaptcha/api.js"], script[src^="https://www.recaptcha.net/recaptcha/api.js"]'
    );

    /**
     * Checks if grecaptcha is ready and resolves the promise
     */
    const onReadyCheck = () => {
      if (window.grecaptcha && typeof window.grecaptcha.ready === "function") {
        resolve();
      }
    };

    // Set a timeout for loading
    const timeout = window.setTimeout(() => {
      reject(
        new Error(
          "reCAPTCHA failed to load. It may be blocked by an ad-blocker/firewall, or the script domain is inaccessible from your network."
        )
      );
    }, 10000);

    /**
     * Handle successful script load
     */
    const handleLoad = () => {
      onReadyCheck();
      if (window.grecaptcha && typeof window.grecaptcha.ready === "function") {
        window.clearTimeout(timeout);
        resolve();
      }
    };

    /**
     * Injects script tag and sets up listeners
     * @param srcIndex - Index in sources array to try
     */
    const tryInject = (srcIndex: number) => {
      const script = document.createElement("script");
      script.src = sources[srcIndex];
      script.async = true;
      script.defer = true;

      script.addEventListener(
        "load",
        () => {
          handleLoad();
        },
        { once: true }
      );

      script.addEventListener(
        "error",
        () => {
          // If google.com failed, try recaptcha.net as fallback
          if (srcIndex < sources.length - 1) {
            tryInject(srcIndex + 1);
            return;
          }
          // All sources failed
          window.clearTimeout(timeout);
          reject(
            new Error(
              "reCAPTCHA script failed to download (blocked or network error). Please disable ad-blockers/firewall rules for this site and try again."
            )
          );
        },
        { once: true }
      );

      document.head.appendChild(script);
    };

    // Handle existing script or inject new one
    if (existing) {
      existing.addEventListener("load", handleLoad, { once: true });
      existing.addEventListener(
        "error",
        () => {
          // Existing script failed; try fallback source.
          tryInject(1);
        },
        { once: true }
      );
    } else {
      tryInject(0);
    }

    // One more check in case it's already available
    queueMicrotask(onReadyCheck);
  });

  return recaptchaLoadPromise;
}

/**
 * useRecaptcha Hook
 * 
 * Provides reCAPTCHA v3 functionality for bot protection.
 * Starts loading the script on mount for faster execution later.
 * 
 * @returns Object with executeRecaptcha function
 * 
 * @example
 * ```tsx
 * const { executeRecaptcha } = useRecaptcha();
 * 
 * const handleSubmit = async () => {
 *   try {
 *     const token = await executeRecaptcha('submit_form');
 *     // Send token to server for verification
 *   } catch (error) {
 *     // Handle reCAPTCHA unavailable
 *   }
 * };
 * ```
 */
export const useRecaptcha = () => {
  // Start loading script on mount
  useEffect(() => {
    loadRecaptcha(RECAPTCHA_SITE_KEY).catch(() => {
      // Swallow error here; the submit handler will show actionable error
    });
  }, []);

  /**
   * Executes reCAPTCHA verification for a specific action
   * 
   * @param action - The action name for scoring (e.g., 'submit', 'login')
   * @returns Promise that resolves with the verification token
   * @throws Error if reCAPTCHA fails to load or execute
   */
  const executeRecaptcha = useCallback(async (action: string): Promise<string> => {
    // Ensure script is loaded
    await loadRecaptcha(RECAPTCHA_SITE_KEY);

    // Execute reCAPTCHA and return token
    return await new Promise((resolve, reject) => {
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
          resolve(token);
        } catch (error) {
          reject(error);
        }
      });
    });
  }, []);

  return { executeRecaptcha };
};
