/**
 * Client-side error logger that captures:
 * - Failed network requests (fetch errors)
 * - Unhandled JS errors
 * - Unhandled promise rejections
 * - console.error calls
 *
 * Logs are batched and flushed to the client_error_logs table.
 */

import { supabase } from "@/integrations/supabase/client";

interface ErrorLogEntry {
  session_id: string;
  user_agent: string;
  page_url: string;
  error_type: string;
  message: string;
  stack?: string;
  request_url?: string;
  request_method?: string;
  response_status?: number;
  console_logs?: unknown[];
  metadata?: Record<string, unknown>;
}

const SESSION_ID = crypto.randomUUID();
const MAX_BUFFER_SIZE = 10;
const FLUSH_INTERVAL_MS = 15_000;
const MAX_CONSOLE_BUFFER = 50;

let logBuffer: ErrorLogEntry[] = [];
let consoleBuffer: { level: string; args: string; ts: number }[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let isInstalled = false;

const createEntry = (
  type: string,
  message: string,
  extra: Partial<ErrorLogEntry> = {}
): ErrorLogEntry => ({
  session_id: SESSION_ID,
  user_agent: navigator.userAgent,
  page_url: location.href,
  error_type: type,
  message,
  console_logs: consoleBuffer.slice(-20),
  ...extra,
});

const enqueue = (entry: ErrorLogEntry) => {
  logBuffer.push(entry);
  if (logBuffer.length >= MAX_BUFFER_SIZE) {
    flush();
  }
};

const flush = async () => {
  if (logBuffer.length === 0) return;
  const batch = logBuffer.splice(0);

  try {
    await supabase.from("client_error_logs" as any).insert(
      batch.map((e) => ({
        session_id: e.session_id,
        user_agent: e.user_agent,
        page_url: e.page_url,
        error_type: e.error_type,
        message: e.message?.slice(0, 2000),
        stack: e.stack?.slice(0, 4000),
        request_url: e.request_url?.slice(0, 500),
        request_method: e.request_method,
        response_status: e.response_status,
        console_logs: e.console_logs,
        metadata: e.metadata,
      }))
    );
  } catch {
    // Silently fail — we can't log errors about logging errors
  }
};

const stringify = (args: unknown[]): string => {
  try {
    return args
      .map((a) => (typeof a === "object" ? JSON.stringify(a)?.slice(0, 500) : String(a)))
      .join(" ")
      .slice(0, 1000);
  } catch {
    return "[unserializable]";
  }
};

/**
 * Install all global error listeners. Call once at app startup.
 */
export const installErrorLogger = () => {
  if (isInstalled) return;
  isInstalled = true;

  // --- Intercept fetch ---
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const [input, init] = args;
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");

    try {
      const response = await originalFetch(...args);

      if (!response.ok && response.status >= 500) {
        enqueue(
          createEntry("network_error", `HTTP ${response.status} ${response.statusText}`, {
            request_url: url,
            request_method: method,
            response_status: response.status,
          })
        );
      }
      return response;
    } catch (error) {
      enqueue(
        createEntry("fetch_failure", error instanceof Error ? error.message : String(error), {
          request_url: url,
          request_method: method,
          stack: error instanceof Error ? error.stack : undefined,
        })
      );
      throw error;
    }
  };

  // --- Global error handler ---
  window.addEventListener("error", (event) => {
    enqueue(
      createEntry("js_error", event.message, {
        stack: event.error?.stack,
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      })
    );
  });

  // --- Unhandled promise rejection ---
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    enqueue(
      createEntry(
        "unhandled_rejection",
        reason instanceof Error ? reason.message : String(reason),
        { stack: reason instanceof Error ? reason.stack : undefined }
      )
    );
  });

  // --- Capture console.error and console.warn ---
  const origError = console.error;
  const origWarn = console.warn;

  console.error = (...args: unknown[]) => {
    const text = stringify(args);
    consoleBuffer.push({ level: "error", args: text, ts: Date.now() });
    if (consoleBuffer.length > MAX_CONSOLE_BUFFER) consoleBuffer.shift();

    enqueue(createEntry("console_error", text));
    origError.apply(console, args);
  };

  console.warn = (...args: unknown[]) => {
    const text = stringify(args);
    consoleBuffer.push({ level: "warn", args: text, ts: Date.now() });
    if (consoleBuffer.length > MAX_CONSOLE_BUFFER) consoleBuffer.shift();
    origWarn.apply(console, args);
  };

  // --- Periodic flush ---
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

  // --- Flush on page unload ---
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
};
