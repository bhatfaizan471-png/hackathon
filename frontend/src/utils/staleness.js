/**
 * Calculates health state based on staleness rules from config/thresholds.json:
 * - Fair after 3 missed intervals (3 * 5s = 15s)
 * - Poor after 60s without heartbeat
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

  if (diffSeconds > 60) {
    return {
      effectiveState: "poor",
      isStale: true,
      secondsAgo: diffSeconds,
      reason: `No heartbeat for ${diffSeconds}s (>60s limit)`,
    };
  }

  if (diffSeconds > sendIntervalSeconds * 3) {
    // 3 missed intervals
    const degradedState = (baseState === "poor") ? "poor" : "fair";
    return {
      effectiveState: degradedState,
      isStale: true,
      secondsAgo: diffSeconds,
      reason: `Heartbeat delayed by ${diffSeconds}s (>15s threshold)`,
    };
  }

  return {
    effectiveState: baseState,
    isStale: false,
    secondsAgo: diffSeconds,
    reason: "Fresh telemetry within active interval",
  };
}
