import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { Activity, ShieldCheck, Lock, Mail, KeyRound, AlertCircle, ArrowRight, UserPlus, LogIn } from "lucide-react";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleToggleMode = (signUpMode) => {
    setIsSignUp(signUpMode);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    if (isSignUp) {
      if (password.length < 8) {
        setError("Password must be at least 8 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (!inviteCode.trim()) {
        setError("Please enter your company invite code.");
        return;
      }
    }

    setLoading(true);

    if (!isSignUp) {
      // Sign In Flow
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        console.error("Sign in failed:", err);
        let msg = "Invalid email or password.";
        if (err.code === "auth/invalid-email") {
          msg = "Invalid email address format.";
        } else if (
          err.code === "auth/user-not-found" ||
          err.code === "auth/wrong-password" ||
          err.code === "auth/invalid-credential"
        ) {
          msg = "Invalid email or password.";
        } else if (err.code === "auth/too-many-requests") {
          msg = "Access temporarily blocked due to repeated failed login attempts. Try again later.";
        } else if (err.message && (err.message.includes("network") || err.message.includes("Network"))) {
          msg = "Network error. Please check your internet connection.";
        } else if (err.message) {
          msg = err.message;
        }
        setError(msg);
      } finally {
        setLoading(false);
      }
    } else {
      // Create Account & Tenant Claim Flow
      let createdUser = null;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        createdUser = userCredential.user;

        const idToken = await createdUser.getIdToken();

        const res = await fetch(`${BACKEND_URL}/v1/claim-tenant`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ invite_code: inviteCode.trim() }),
        });

        if (!res.ok) {
          // Backend rejected invite code -> delete created user immediately to prevent orphan accounts
          try {
            await deleteUser(createdUser);
          } catch (delErr) {
            console.warn("Failed to delete orphan user after rejected claim:", delErr);
          }

          let detail = "";
          try {
            const errData = await res.json();
            detail = errData.detail;
          } catch {}

          if (res.status === 403) {
            setError(detail || "Invalid or expired invite code.");
          } else if (res.status === 409) {
            setError(detail || "User already assigned to a tenant.");
          } else {
            setError(detail || `Failed to assign tenant (HTTP ${res.status}).`);
          }
          return;
        }

        // Claim assigned successfully -> refresh token so claims load
        await createdUser.getIdToken(true);
      } catch (err) {
        console.error("Sign up failed:", err);
        if (createdUser) {
          try {
            await deleteUser(createdUser);
          } catch {}
        }
        let msg = "Sign up failed. Please try again.";
        if (err.code === "auth/email-already-in-use") {
          msg = "An account with this email already exists.";
        } else if (err.code === "auth/weak-password") {
          msg = "Password must be at least 8 characters long.";
        } else if (err.code === "auth/invalid-email") {
          msg = "Invalid email address format.";
        } else if (err.message && (err.message.includes("network") || err.message.includes("Failed to fetch"))) {
          msg = "Network error. Please check your internet connection.";
        } else if (err.message) {
          msg = err.message;
        }
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f8faf8] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-2xl bg-[#0c4a3e] flex items-center justify-center shadow-lg shadow-[#0c4a3e]/20">
            <Activity className="h-6 w-6 text-white" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-[#0c4a3e]">
          Nexus Observe
        </h2>
        <p className="mt-1 text-center text-xs text-stone-500 font-medium">
          Privacy-First Two-Tier Observability • Tenant Access
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-stone-200 rounded-3xl sm:px-10">
          {/* Toggle "Sign in" / "Create account" */}
          <div className="flex rounded-xl bg-stone-100 p-1 mb-6">
            <button
              type="button"
              data-testid="toggle-signin"
              onClick={() => handleToggleMode(false)}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-bold rounded-lg transition ${
                !isSignUp
                  ? "bg-white text-[#0c4a3e] shadow-sm"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              data-testid="toggle-signup"
              onClick={() => handleToggleMode(true)}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-bold rounded-lg transition ${
                isSignUp
                  ? "bg-white text-[#0c4a3e] shadow-sm"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Create Account</span>
            </button>
          </div>

          {error && (
            <div data-testid="auth-error" className="mb-5 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start space-x-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Work Email
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  data-testid="input-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="block w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#0c4a3e] focus:border-[#0c4a3e] font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Password {isSignUp && <span className="text-[10px] font-normal text-stone-400">(min 8 characters)</span>}
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  data-testid="input-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#0c4a3e] focus:border-[#0c4a3e] font-medium"
                />
              </div>
            </div>

            {isSignUp && (
              <>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type="password"
                      required
                      data-testid="input-confirm-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#0c4a3e] focus:border-[#0c4a3e] font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Company Invite Code
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      data-testid="input-invite-code"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="NXO-XXXX-XXXX"
                      className="block w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 uppercase font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-[#0c4a3e] focus:border-[#0c4a3e]"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="submit-btn"
              className="w-full mt-2 flex justify-center items-center space-x-2 py-2.5 px-4 rounded-xl shadow-sm shadow-[#0c4a3e]/20 text-xs font-bold text-white bg-[#0c4a3e] hover:bg-[#093930] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0c4a3e] transition disabled:opacity-50"
            >
              <span>{loading ? "Processing..." : isSignUp ? "Create Account & Join Tenant" : "Sign In to Dashboard"}</span>
              {!loading && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </form>

          {/* Demo access (simulated data only) */}
          <div className="mt-6 pt-5 border-t border-stone-100">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-2.5">
              Demo access (simulated data only)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl border border-stone-200 bg-[#f8faf8]">
                <div className="font-bold text-xs text-[#0c4a3e]">Company A (Acme Demo)</div>
                <div className="text-[10px] text-stone-500 font-mono mt-0.5">a@acme.test</div>
              </div>
              <div className="p-2.5 rounded-xl border border-stone-200 bg-[#f8faf8]">
                <div className="font-bold text-xs text-[#0c4a3e]">Company B (Beta Corp)</div>
                <div className="text-[10px] text-stone-500 font-mono mt-0.5">b@beta.test</div>
              </div>
            </div>
            <p className="text-[11px] text-stone-500 mt-2.5 text-center font-medium">
              Password provided by the team
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
