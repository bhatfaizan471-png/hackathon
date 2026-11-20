import { describe, it, expect } from "vitest";
import { calculateStaleness } from "../utils/staleness";
import { computeSha256 } from "../utils/crypto";

describe("Stage 5 Frontend Unit & Regression Tests", () => {
  it("computes matching SHA-256 for identical JSON", async () => {
    const payload = JSON.stringify({ test: "data", val: 123 });
    const hash1 = await computeSha256(payload);
    const hash2 = await computeSha256(payload);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it("detects tampered payload hash mismatch", async () => {
    const original = JSON.stringify({ test: "data" });
    const tampered = JSON.stringify({ test: "data", secret: "leaked_pass" });
    const h1 = await computeSha256(original);
    const h2 = await computeSha256(tampered);
    expect(h1).not.toBe(h2);
  });

  it("flags stale host as Poor after 60s without heartbeat", () => {
    const now = Date.now();
    const staleTime = new Date(now - 70 * 1000).toISOString();
    const result = calculateStaleness(staleTime, "good", 5);
    expect(result.effectiveState).toBe("poor");
    expect(result.isStale).toBe(true);
    expect(result.reason).toContain(">60s limit");
  });

  it("flags stale host as Fair after 3 missed intervals (>15s)", () => {
    const now = Date.now();
    const staleTime = new Date(now - 20 * 1000).toISOString();
    const result = calculateStaleness(staleTime, "good", 5);
    expect(result.effectiveState).toBe("fair");
    expect(result.isStale).toBe(true);
  });

  it("keeps fresh host healthy within normal interval", () => {
    const now = Date.now();
    const freshTime = new Date(now - 3 * 1000).toISOString();
    const result = calculateStaleness(freshTime, "excellent", 5);
    expect(result.effectiveState).toBe("excellent");
    expect(result.isStale).toBe(false);
  });
});
