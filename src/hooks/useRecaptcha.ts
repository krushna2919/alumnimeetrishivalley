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
    const sources = [
      `https://www.google.com/recaptcha/api.js?render=${siteKey}`,
      `https://www.recaptcha.net/recaptcha/api.js?render=${siteKey}`,
    ];

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://www.google.com/recaptcha/api.js"], script[src^="https://www.recaptcha.net/recaptcha/api.js"]'
    );

    const onReadyCheck = () => {
      if (window.grecaptcha && typeof window.grecaptcha.ready === "function") {
        resolve();
      }
    };

    const timeout = window.setTimeout(() => {
      reject(
        new Error(
          "reCAPTCHA failed to load. It may be blocked by an ad-blocker/firewall, or the script domain is inaccessible from your network."
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
          if (srcIndex < sources.length - 1) {
            // Fallback to recaptcha.net if google.com is blocked
            tryInject(srcIndex + 1);
            return;
          }
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
