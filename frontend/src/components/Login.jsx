import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { Activity, ShieldCheck, Lock, Mail, KeyRound, AlertCircle, ArrowRight, UserPlus, LogIn, Download, CheckCircle2 } from "lucide-react";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

export default function Login({ onGetCollector }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState(null);
  const [popupNotification, setPopupNotification] = useState(null);
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
        console.error(`[Firebase Auth Diagnostic] code: "${err?.code}" | message: "${err?.message}"`);
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

        let detail = "";
        let resData = {};
        try {
          resData = await res.json();
          detail = resData.detail;
        } catch {}

        if (!res.ok) {
          // Backend rejected invite code -> delete created user immediately to prevent orphan accounts
          try {
            await deleteUser(createdUser);
          } catch (delErr) {
            console.warn("Failed to delete orphan user after rejected claim:", delErr);
          }

          if (res.status === 403) {
            setError(detail || "Invalid or expired invite code.");
          } else if (res.status === 409) {
            setError(detail || "User already assigned to a tenant.");
          } else {
            setError(detail || `Failed to assign tenant (HTTP ${res.status}).`);
          }
          return;
        }

        // Account created and stored in database successfully -> show pop up notification
        if (typeof window !== "undefined" && window.sessionStorage) {
          sessionStorage.setItem("nexus_just_created_account", email);
        }

        setPopupNotification({
          title: "Account Created Successfully!",
          message: `Your account (${email}) has been registered and stored in the database.`,
        });

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
    <div className="min-h-screen bg-[#f7f4ee] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background light orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-gradient-to-tr from-[#60896a]/15 via-[#b5a281]/15 to-transparent rounded-full blur-3xl animate-soft-pulse" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-[#37543e]/8 rounded-full blur-2xl" />
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-[#b5a281]/12 rounded-full blur-2xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-in">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-[#1c382b] flex items-center justify-center shadow-lg shadow-[#1c382b]/20 animate-float-slow">
            <Activity className="h-7 w-7 text-[#cbdccf]" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold tracking-tight text-[#1c382b]">
          Nexus Observe
        </h2>
        <p className="mt-1.5 text-center text-xs text-[#756449] font-medium tracking-wide">
          Privacy-First Two-Tier Observability • Tenant Access
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-in">
        <div className="bg-[#faf7f2]/95 backdrop-blur-md py-8 px-6 shadow-xl shadow-[#362d20]/5 border border-[#e5dec9] rounded-3xl sm:px-10">
          {/* Toggle "Sign in" / "Create account" */}
          <div className="flex rounded-xl bg-[#ede7dc] p-1 mb-6 border border-[#ded2be] shadow-inner">
            <button
              type="button"
              data-testid="toggle-signin"
              onClick={() => handleToggleMode(false)}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-bold rounded-lg transition-all duration-200 btn-tactile ${
                !isSignUp
                  ? "bg-[#faf7f2] text-[#1c382b] shadow-xs scale-[1.01]"
                  : "text-[#756449] hover:text-[#24221f]"
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              data-testid="toggle-signup"
              onClick={() => handleToggleMode(true)}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-bold rounded-lg transition-all duration-200 btn-tactile ${
                isSignUp
                  ? "bg-[#faf7f2] text-[#1c382b] shadow-xs scale-[1.01]"
                  : "text-[#756449] hover:text-[#24221f]"
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Create Account</span>
            </button>
          </div>

          {error && (
            <div data-testid="auth-error" className="mb-5 rounded-2xl bg-rose-50/90 border border-rose-200 p-4 text-xs text-rose-800 flex items-start space-x-2.5 animate-slide-down">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed font-medium">{error}</div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-[#544733] uppercase tracking-wider mb-1.5">
                Work Email
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#968262]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  data-testid="input-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#f4f0e6]/80 border border-[#ded2be] rounded-xl text-xs text-[#24221f] placeholder-[#b5a281] focus:bg-[#faf7f2] focus:outline-none focus:ring-2 focus:ring-[#37543e]/20 focus:border-[#37543e] font-medium transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#544733] uppercase tracking-wider mb-1.5">
                Password {isSignUp && <span className="text-[10px] font-normal text-[#968262]">(min 8 characters)</span>}
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#968262]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  data-testid="input-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#f4f0e6]/80 border border-[#ded2be] rounded-xl text-xs text-[#24221f] placeholder-[#b5a281] focus:bg-[#faf7f2] focus:outline-none focus:ring-2 focus:ring-[#37543e]/20 focus:border-[#37543e] font-medium transition-all duration-200"
                />
              </div>
            </div>

            {isSignUp && (
              <>
                <div className="animate-slide-down">
                  <label className="block text-xs font-bold text-[#544733] uppercase tracking-wider mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#968262]">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type="password"
                      required
                      data-testid="input-confirm-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-10 pr-3 py-2.5 bg-[#f4f0e6]/80 border border-[#ded2be] rounded-xl text-xs text-[#24221f] placeholder-[#b5a281] focus:bg-[#faf7f2] focus:outline-none focus:ring-2 focus:ring-[#37543e]/20 focus:border-[#37543e] font-medium transition-all duration-200"
                    />
                  </div>
                </div>

                <div className="animate-slide-down">
                  <label className="block text-xs font-bold text-[#544733] uppercase tracking-wider mb-1.5">
                    Company Invite Code
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#968262]">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      data-testid="input-invite-code"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="NXO-XXXX-XXXX"
                      className="block w-full pl-10 pr-3 py-2.5 bg-[#f4f0e6]/80 border border-[#ded2be] rounded-xl text-xs text-[#24221f] placeholder-[#b5a281] uppercase font-mono tracking-wider focus:bg-[#faf7f2] focus:outline-none focus:ring-2 focus:ring-[#37543e]/20 focus:border-[#37543e] transition-all duration-200"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="submit-btn"
              className="w-full mt-3 flex justify-center items-center space-x-2 py-3 px-4 rounded-xl shadow-md shadow-[#1c382b]/20 text-xs font-bold text-[#faf7f2] bg-[#1c382b] hover:bg-[#14291f] btn-tactile focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1c382b] transition-all duration-200 disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? "Processing..." : isSignUp ? "Create Account & Join Tenant" : "Sign In to Dashboard"}</span>
              {!loading && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </form>

          {/* Public Link to Collector Setup */}
          <div className="mt-4 pt-4 border-t border-[#eee8dc] text-center">
            <button
              type="button"
              onClick={onGetCollector || (() => { if (typeof window !== "undefined") window.location.hash = "#collector"; })}
              data-testid="get-collector-btn"
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#1c382b] hover:text-[#37543e] hover:underline cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#37543e]" />
              <span>Setting up a machine? Get the Collector &rarr;</span>
            </button>
          </div>

          {/* Demo access (simulated data only) */}
          <div className="mt-6 pt-5 border-t border-[#eee8dc]">
            <span className="text-[11px] font-bold text-[#756449] uppercase tracking-wider block mb-2.5">
              Demo access (simulated data only)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl border border-[#e5dec9] bg-[#f5f1e8] hover:border-[#37543e]/40 transition-colors">
                <div className="font-bold text-xs text-[#1c382b]">Company A (Acme Demo)</div>
                <div className="text-[10px] text-[#756449] font-mono mt-0.5">a@acme.test</div>
              </div>
              <div className="p-2.5 rounded-xl border border-[#e5dec9] bg-[#f5f1e8] hover:border-[#37543e]/40 transition-colors">
                <div className="font-bold text-xs text-[#1c382b]">Company B (Beta Corp)</div>
                <div className="text-[10px] text-[#756449] font-mono mt-0.5">b@beta.test</div>
              </div>
            </div>
            <p className="text-[11px] text-[#756449] mt-2.5 text-center font-medium">
              Password provided by the team
            </p>
          </div>
        </div>
      </div>

      {/* Pop Up Notification on Account Creation */}
      {popupNotification && (
        <div
          data-testid="account-created-popup"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-[#faf7f2] border-2 border-[#37543e] rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4 text-center transform scale-100 transition-transform">
            <div className="h-14 w-14 rounded-2xl bg-[#e6ede7] border border-[#cbdccf] flex items-center justify-center mx-auto text-[#1c382b] shadow-sm">
              <CheckCircle2 className="h-8 w-8 text-[#37543e] animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold text-[#1c382b]">
                {popupNotification.title}
              </h3>
              <p className="text-xs text-[#544733] leading-relaxed">
                {popupNotification.message}
              </p>
              <div className="mt-2 text-[11px] font-semibold text-emerald-800 bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-200">
                ✓ Stored in database & assigned to tenant
              </div>
            </div>
            <button
              type="button"
              data-testid="popup-continue-btn"
              onClick={() => setPopupNotification(null)}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-[#faf7f2] bg-[#1c382b] hover:bg-[#14291f] btn-tactile shadow-sm cursor-pointer"
            >
              Continue to Dashboard &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
