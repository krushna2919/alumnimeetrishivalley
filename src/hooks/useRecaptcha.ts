import { useEffect, useCallback } from "react";

// Your reCAPTCHA v3 Site Key - replace with your actual key
const RECAPTCHA_SITE_KEY = "6LchWkgsAAAAAIWpNxur7VomXXyOQVuy9eoDUD3d";

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export const useRecaptcha = () => {
  useEffect(() => {
    // Check if script already exists
    if (document.querySelector(`script[src*="recaptcha"]`)) {
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount if needed
    };
  }, []);

  const executeRecaptcha = useCallback(async (action: string): Promise<string> => {
    // Wait for reCAPTCHA to be available with retry logic
    const waitForRecaptcha = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait
        
        const checkRecaptcha = () => {
          attempts++;
          if (window.grecaptcha && typeof window.grecaptcha.ready === 'function') {
            resolve();
          } else if (attempts >= maxAttempts) {
            reject(new Error("reCAPTCHA failed to load. Please refresh the page and try again."));
          } else {
            setTimeout(checkRecaptcha, 100);
          }
        };
        
        checkRecaptcha();
      });
    };

    await waitForRecaptcha();
    
    return new Promise((resolve, reject) => {
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
