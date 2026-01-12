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

let recaptchaLoadPromise: Promise<void> | null = null;

function loadRecaptcha(siteKey: string): Promise<void> {
  // If already available, we're done
  if (window.grecaptcha && typeof window.grecaptcha.ready === "function") {
    return Promise.resolve();
  }

  if (recaptchaLoadPromise) return recaptchaLoadPromise;

  recaptchaLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://www.google.com/recaptcha/api.js"]'
    );

    const onReadyCheck = () => {
      if (window.grecaptcha && typeof window.grecaptcha.ready === "function") {
        resolve();
      }
    };

    const timeout = window.setTimeout(() => {
      reject(
        new Error(
          "reCAPTCHA failed to load. Please disable ad-blockers for this site or ensure this domain is allowed in your reCAPTCHA settings, then refresh and try again."
        )
      );
    }, 10000);

    const handleLoad = () => {
      onReadyCheck();
      if (window.grecaptcha && typeof window.grecaptcha.ready === "function") {
        window.clearTimeout(timeout);
        resolve();
      }
    };

    const handleError = () => {
      window.clearTimeout(timeout);
      reject(
        new Error(
          "reCAPTCHA script failed to download (blocked or network error). Please disable ad-blockers for this site and try again."
        )
      );
    };

    if (existing) {
      existing.addEventListener("load", handleLoad, { once: true });
      existing.addEventListener("error", handleError, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });
      document.head.appendChild(script);
    }

    // One more microtask tick to catch immediate availability
    queueMicrotask(onReadyCheck);
  });

  return recaptchaLoadPromise;
}

export const useRecaptcha = () => {
  useEffect(() => {
    // Start loading as early as possible
    loadRecaptcha(RECAPTCHA_SITE_KEY).catch(() => {
      // Intentionally swallow here; the submit handler will show the actionable error.
    });
  }, []);

  const executeRecaptcha = useCallback(async (action: string): Promise<string> => {
    await loadRecaptcha(RECAPTCHA_SITE_KEY);

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
