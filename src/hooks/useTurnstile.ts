import { useEffect, useCallback, useRef } from "react";

// Cloudflare Turnstile Site Key
// Cloudflare Turnstile - Using visible test key that always passes
// See: https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TURNSTILE_SITE_KEY = "1x00000000000000000000AA";

declare global {
  interface Window {
    turnstile: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact";
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string | undefined;
      execute: (container: string | HTMLElement, options: { sitekey: string }) => void;
    };
  }
}

let turnstileLoadPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve();
  }

  if (turnstileLoadPromise) return turnstileLoadPromise;

  turnstileLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;

    const timeout = window.setTimeout(() => {
      reject(new Error("Turnstile failed to load. Please check your internet connection."));
    }, 10000);

    script.addEventListener(
      "load",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );

    script.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout);
        reject(new Error("Failed to load Turnstile script."));
      },
      { once: true }
    );

    document.head.appendChild(script);
  });

  return turnstileLoadPromise;
}

export const useTurnstile = (containerId: string = "turnstile-container") => {
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const isRenderedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const initTurnstile = async () => {
      try {
        await loadTurnstile();
        
        if (!mounted) return;

        const container = document.getElementById(containerId);
        if (!container || isRenderedRef.current) return;

        // Clear any existing content
        container.innerHTML = "";

        widgetIdRef.current = window.turnstile.render(container, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => {
            tokenRef.current = token;
          },
          "error-callback": () => {
            tokenRef.current = null;
            console.error("Turnstile error occurred");
          },
          "expired-callback": () => {
            tokenRef.current = null;
          },
          theme: "auto",
          size: "normal",
        });
        
        isRenderedRef.current = true;
      } catch (error) {
        console.error("Failed to initialize Turnstile:", error);
      }
    };

    initTurnstile();

    return () => {
      mounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // Widget may already be removed
        }
      }
      isRenderedRef.current = false;
    };
  }, [containerId]);

  const getToken = useCallback((): string | null => {
    if (widgetIdRef.current && window.turnstile) {
      return window.turnstile.getResponse(widgetIdRef.current) || tokenRef.current;
    }
    return tokenRef.current;
  }, []);

  const resetTurnstile = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      tokenRef.current = null;
    }
  }, []);

  return { getToken, resetTurnstile, siteKey: TURNSTILE_SITE_KEY };
};
