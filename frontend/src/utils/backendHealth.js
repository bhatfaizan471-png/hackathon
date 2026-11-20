import { useState, useEffect, useCallback } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

export function useBackendHealth() {
  const [status, setStatus] = useState("checking"); // checking | online | offline
  const [details, setDetails] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const checkHealth = useCallback(async () => {
    const startTime = performance.now();
    try {
      // Try local proxy first, then direct URL
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      let res;
      try {
        res = await fetch("/api/health", { signal: controller.signal });
      } catch (e) {
        // Fallback to direct URL if dev proxy not active
        res = await fetch(`${BACKEND_URL}/health`, { signal: controller.signal });
      }

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const duration = Math.round(performance.now() - startTime);
        setStatus("online");
        setDetails(data);
        setLatencyMs(duration);
        setLastChecked(new Date().toLocaleTimeString());
      } else {
        setStatus("offline");
        setDetails(null);
        setLatencyMs(null);
        setLastChecked(new Date().toLocaleTimeString());
      }
    } catch (err) {
      setStatus("offline");
      setDetails(null);
      setLatencyMs(null);
      setLastChecked(new Date().toLocaleTimeString());
    }
  }, []);

  useEffect(() => {
    checkHealth();
    // Poll every 15 seconds
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return { status, details, latencyMs, lastChecked, checkHealth };
}
