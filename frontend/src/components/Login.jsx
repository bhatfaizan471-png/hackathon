import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Activity, ShieldCheck, Lock, Mail, AlertCircle, ArrowRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error("Sign in failed:", err);
      let msg = "Invalid credentials. Please verify your email and password.";
      if (err.code === "auth/user-not-found") {
        msg = "No user found with this email. Run 'python -m backend.scripts.set_tenant_claims' to create demo users.";
      } else if (err.code === "auth/wrong-password") {
        msg = "Incorrect password. Default demo password is 'Password123!'.";
      } else if (err.code === "auth/too-many-requests") {
        msg = "Access temporarily blocked due to repeated failed login attempts. Try again later.";
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (demoEmail) => {
    setEmail(demoEmail);
    setPassword("Password123!");
    setError(null);
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
          Privacy-First Two-Tier Observability • Tenant Sign In
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-stone-200 rounded-3xl sm:px-10">
          {error && (
            <div className="mb-5 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start space-x-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleLogin}>
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.test"
                  className="block w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#0c4a3e] focus:border-[#0c4a3e] font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#0c4a3e] focus:border-[#0c4a3e] font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex justify-center items-center space-x-2 py-2.5 px-4 rounded-xl shadow-sm shadow-[#0c4a3e]/20 text-xs font-bold text-white bg-[#0c4a3e] hover:bg-[#093930] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0c4a3e] transition disabled:opacity-50"
            >
              <span>{loading ? "Authenticating..." : "Sign In to Dashboard"}</span>
              {!loading && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </form>

          {/* Demo Credentials Quick-Select */}
          <div className="mt-6 pt-5 border-t border-stone-100">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-2.5">
              Demo Tenant Accounts
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillCredentials("a@acme.test")}
                className="p-2.5 text-left rounded-xl border border-stone-200 bg-[#f8faf8] hover:bg-[#e7f3ec] hover:border-[#cbe6d5] transition"
              >
                <div className="font-bold text-xs text-[#0c4a3e]">Acme Demo</div>
                <div className="text-[10px] text-stone-500 font-mono mt-0.5">a@acme.test</div>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials("b@beta.test")}
                className="p-2.5 text-left rounded-xl border border-stone-200 bg-[#f8faf8] hover:bg-[#e7f3ec] hover:border-[#cbe6d5] transition"
              >
                <div className="font-bold text-xs text-[#0c4a3e]">Beta Corp</div>
                <div className="text-[10px] text-stone-500 font-mono mt-0.5">b@beta.test</div>
              </button>
            </div>
            <p className="text-[10px] text-stone-400 mt-2 text-center">
              Password: <code className="font-mono text-stone-600">Password123!</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
