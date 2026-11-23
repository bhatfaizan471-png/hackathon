/**
 * Calculates health state based on staleness rules from config/thresholds.json:
 * - Stale after max(15, 3 * interval) seconds (degraded to fair if not already poor)
 * - Poor/offline after max(60, 4 * interval) seconds
 */
export function calculateStaleness(lastSeenUtc, baseState = "excellent", sendIntervalSeconds = 5) {
  if (!lastSeenUtc) {
    return {
      effectiveState: "poor",
      isStale: true,
      secondsAgo: null,
      reason: "No heartbeat received yet",
    };
  }

  const lastSeen = new Date(lastSeenUtc).getTime();
  const now = Date.now();
  const diffSeconds = Math.max(0, Math.floor((now - lastSeen) / 1000));

  const interval = Number(sendIntervalSeconds) || 5;
  const poorThreshold = Math.max(60, 4 * interval);
  const staleThreshold = Math.max(15, 3 * interval);

  if (diffSeconds > poorThreshold) {
    return {
      effectiveState: "poor",
      isStale: true,
      secondsAgo: diffSeconds,
      reason: `No heartbeat for ${diffSeconds}s (>${poorThreshold}s limit)`,
    };
  }

  if (diffSeconds > staleThreshold) {
    // Stale: stale data never shows as healthy
    const degradedState = (baseState === "poor") ? "poor" : "fair";
    return {
      effectiveState: degradedState,
      isStale: true,
      secondsAgo: diffSeconds,
      reason: `Heartbeat delayed by ${diffSeconds}s (>${staleThreshold}s threshold)`,
    };
  }

  return {
    effectiveState: baseState,
    isStale: false,
    secondsAgo: diffSeconds,
    reason: "Fresh telemetry within active interval",
  };
}
