// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import GetCollector from "../components/GetCollector";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("GetCollector Public Page Tests", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders main headings, download link, and SHA-256 checksum", async () => {
    await act(async () => {
      root.render(<GetCollector />);
    });

    // Check main title
    expect(container.textContent).toContain("Install the Nexus Collector");

    // Check download button attributes
    const downloadLink = container.querySelector('a[href="/downloads/nexus-collector.zip"]');
    expect(downloadLink).not.toBeNull();
    expect(downloadLink.getAttribute("download")).toBe("nexus-collector.zip");
    expect(downloadLink.textContent).toContain("nexus-collector.zip");

    // Check SHA-256 checksum is displayed
    expect(container.textContent).toContain("e1c42cbcab543353cce03e2db86b97691e91d59104b570d241627136cb54cd30");
  });

  it("renders GitHub clone instructions and commands", async () => {
    await act(async () => {
      root.render(<GetCollector />);
    });

    expect(container.textContent).toContain("Option B: Clone with Git");
    expect(container.textContent).toContain("git clone https://github.com/bhatfaizan471-png/hackathon.git");
    expect(container.textContent).toContain("cd hackathon");
  });

  it("renders privacy policy with allow-list and never-send comparisons", async () => {
    await act(async () => {
      root.render(<GetCollector />);
    });

    expect(container.textContent).toContain("Zero PII Guarantee");
    expect(container.textContent).toContain("Allowed System Metrics");
    expect(container.textContent).toContain("Strictly Prohibited & Never Sent");
    expect(container.textContent).toContain("No Usernames or Passwords");
    expect(container.textContent).toContain("No IP Addresses");
    expect(container.textContent).toContain("No Hostnames");
    expect(container.textContent).toContain("No Raw Log Text");
  });

  it("clicking copy button calls clipboard writeText", async () => {
    await act(async () => {
      root.render(<GetCollector />);
    });

    const copyButtons = container.querySelectorAll("button");
    const shaCopyBtn = Array.from(copyButtons).find((b) => b.textContent.includes("Copy"));
    expect(shaCopyBtn).toBeDefined();

    await act(async () => {
      shaCopyBtn.click();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
