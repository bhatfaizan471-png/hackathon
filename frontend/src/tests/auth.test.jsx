// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mock Firebase Auth before importing component
vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("../firebase", () => ({
  auth: {},
}));

import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import Login from "../components/Login";

function setNativeInputValue(element, value) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  descriptor.set.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Login and Tenant Claim Flow Tests", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("toggle works between Sign In and Create Account modes", async () => {
    await act(async () => {
      root.render(<Login />);
    });

    // Initially in Sign In mode
    expect(container.querySelector('[data-testid="input-confirm-password"]')).toBeNull();
    expect(container.querySelector('[data-testid="input-invite-code"]')).toBeNull();

    // Click Create Account toggle
    const toggleSignUp = container.querySelector('[data-testid="toggle-signup"]');
    await act(async () => {
      toggleSignUp.click();
    });

    // Confirm password and invite code inputs should now be visible
    expect(container.querySelector('[data-testid="input-confirm-password"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="input-invite-code"]')).not.toBeNull();

    // Toggle back to Sign In
    const toggleSignIn = container.querySelector('[data-testid="toggle-signin"]');
    await act(async () => {
      toggleSignIn.click();
    });

    expect(container.querySelector('[data-testid="input-confirm-password"]')).toBeNull();
    expect(container.querySelector('[data-testid="input-invite-code"]')).toBeNull();
  });

  it("password mismatch is rejected during account creation", async () => {
    await act(async () => {
      root.render(<Login />);
    });

    // Toggle to Create Account
    const toggleSignUp = container.querySelector('[data-testid="toggle-signup"]');
    await act(async () => {
      toggleSignUp.click();
    });

    const emailInput = container.querySelector('[data-testid="input-email"]');
    const passInput = container.querySelector('[data-testid="input-password"]');
    const confirmInput = container.querySelector('[data-testid="input-confirm-password"]');
    const inviteInput = container.querySelector('[data-testid="input-invite-code"]');

    await act(async () => {
      setNativeInputValue(emailInput, "test@company.com");
      setNativeInputValue(passInput, "SecurePassword1!");
      setNativeInputValue(confirmInput, "MismatchPassword2!");
      setNativeInputValue(inviteInput, "NXO-TEST-1234");
    });

    // Submit form
    const form = container.querySelector("form");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    const errorBox = container.querySelector('[data-testid="auth-error"]');
    expect(errorBox).not.toBeNull();
    expect(errorBox.textContent).toContain("Passwords do not match");
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it("the claim call sends the Bearer token in the Authorization header", async () => {
    const mockUser = {
      getIdToken: vi.fn().mockImplementation((force) => Promise.resolve("mock-firebase-id-token-abc123")),
    };
    createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });

    let capturedUrl = "";
    let capturedOptions = null;
    global.fetch = vi.fn().mockImplementation((url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ tenant_id: "tenant_acme_demo" }),
      });
    });

    await act(async () => {
      root.render(<Login />);
    });

    // Toggle to Create Account
    const toggleSignUp = container.querySelector('[data-testid="toggle-signup"]');
    await act(async () => {
      toggleSignUp.click();
    });

    const emailInput = container.querySelector('[data-testid="input-email"]');
    const passInput = container.querySelector('[data-testid="input-password"]');
    const confirmInput = container.querySelector('[data-testid="input-confirm-password"]');
    const inviteInput = container.querySelector('[data-testid="input-invite-code"]');

    await act(async () => {
      setNativeInputValue(emailInput, "newuser@acme.test");
      setNativeInputValue(passInput, "ValidPassword123!");
      setNativeInputValue(confirmInput, "ValidPassword123!");
      setNativeInputValue(inviteInput, "NXO-ACME-5678");
    });

    const form = container.querySelector("form");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(createUserWithEmailAndPassword).toHaveBeenCalled();
    expect(capturedUrl).toContain("/v1/claim-tenant");
    expect(capturedOptions.headers["Authorization"]).toBe("Bearer mock-firebase-id-token-abc123");
    expect(JSON.parse(capturedOptions.body)).toEqual({ invite_code: "NXO-ACME-5678" });
    // User token refreshed to load claim
    expect(mockUser.getIdToken).toHaveBeenCalledWith(true);
    expect(container.querySelector('[data-testid="account-created-popup"]')).not.toBeNull();
    expect(container.textContent).toContain("Account Created Successfully!");
  });

  it("a rejected invite deletes the created user to prevent orphan accounts", async () => {
    const mockUser = {
      uid: "orphan_user_123",
      getIdToken: vi.fn().mockResolvedValue("mock-firebase-id-token-xyz"),
    };
    createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    deleteUser.mockResolvedValue();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ detail: "Invalid or expired invite code." }),
    });

    await act(async () => {
      root.render(<Login />);
    });

    // Toggle to Create Account
    const toggleSignUp = container.querySelector('[data-testid="toggle-signup"]');
    await act(async () => {
      toggleSignUp.click();
    });

    const emailInput = container.querySelector('[data-testid="input-email"]');
    const passInput = container.querySelector('[data-testid="input-password"]');
    const confirmInput = container.querySelector('[data-testid="input-confirm-password"]');
    const inviteInput = container.querySelector('[data-testid="input-invite-code"]');

    await act(async () => {
      setNativeInputValue(emailInput, "orphan@test.com");
      setNativeInputValue(passInput, "Password123!");
      setNativeInputValue(confirmInput, "Password123!");
      setNativeInputValue(inviteInput, "NXO-BAD-CODE");
    });

    const form = container.querySelector("form");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    // Expect deleteUser to have been called on the orphan user
    expect(deleteUser).toHaveBeenCalledWith(mockUser);

    const errorBox = container.querySelector('[data-testid="auth-error"]');
    expect(errorBox).not.toBeNull();
    expect(errorBox.textContent).toContain("Invalid or expired invite code");
  });
});
