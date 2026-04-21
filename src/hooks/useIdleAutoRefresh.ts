/**
 * useIdleAutoRefresh.ts - Idle Warning + Auto-Refresh Hook
 *
 * Encourages users to complete the registration form promptly.
 * - After `warnAfterMs` of inactivity, shows a toast asking the user to finish.
 * - After `refreshAfterMs` of total inactivity, automatically refreshes the page
 *   so a stale form (with expired tokens, old config, etc.) doesn't get submitted.
 *
 * "Activity" = any keypress, mouse click, scroll, or touch on the page.
 * The timer resets on every interaction.
 *
 * Pass `enabled = false` once the form is successfully submitted to stop the timer.
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface Options {
  enabled?: boolean;
  warnAfterMs?: number;     // default 5 min
  refreshAfterMs?: number;  // default 10 min
}

export const useIdleAutoRefresh = ({
  enabled = true,
  warnAfterMs = 5 * 60 * 1000,
  refreshAfterMs = 10 * 60 * 1000,
}: Options = {}) => {
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const clearTimers = () => {
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };

    const scheduleTimers = () => {
      clearTimers();

      warnTimerRef.current = setTimeout(() => {
        if (warnedRef.current) return;
        warnedRef.current = true;
        const minutesLeft = Math.round((refreshAfterMs - warnAfterMs) / 60000);
        toast.warning("Please complete your registration soon", {
          description: `For your security, this page will auto-refresh in about ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"} if left idle. Any unsaved changes will be lost.`,
          duration: 10000,
        });
      }, warnAfterMs);

      refreshTimerRef.current = setTimeout(() => {
        toast("Refreshing page due to inactivity…", { duration: 2000 });
        setTimeout(() => window.location.reload(), 1500);
      }, refreshAfterMs);
    };

    const handleActivity = () => {
      warnedRef.current = false;
      scheduleTimers();
    };

    const events: Array<keyof WindowEventMap> = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];
    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    scheduleTimers();

    return () => {
      clearTimers();
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [enabled, warnAfterMs, refreshAfterMs]);
};
