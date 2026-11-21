import { describe, it, expect } from "vitest";
import { getIngestUrls } from "../utils/ingestUrl";

describe("getIngestUrls utility tests", () => {
  it("production returns one URL (only direct backendUrl)", () => {
    const urls = getIngestUrls({
      isProd: true,
      backendUrl: "https://nexus-observe-backend.onrender.com",
    });

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://nexus-observe-backend.onrender.com/v1/ingest");
  });

  it("development returns two URLs (proxy first, then direct backendUrl)", () => {
    const urls = getIngestUrls({
      isProd: false,
      backendUrl: "http://127.0.0.1:8000",
    });

    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe("/api/v1/ingest");
    expect(urls[1]).toBe("http://127.0.0.1:8000/v1/ingest");
  });

  it("strips trailing slash from backendUrl in both production and development", () => {
    const prodUrls = getIngestUrls({
      isProd: true,
      backendUrl: "https://nexus-observe-backend.onrender.com/",
    });
    expect(prodUrls).toEqual([
      "https://nexus-observe-backend.onrender.com/v1/ingest",
    ]);

    const devUrls = getIngestUrls({
      isProd: false,
      backendUrl: "http://127.0.0.1:8000///",
    });
    expect(devUrls).toEqual([
      "/api/v1/ingest",
      "http://127.0.0.1:8000/v1/ingest",
    ]);
  });
});
