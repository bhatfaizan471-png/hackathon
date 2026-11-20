import React from "react";
import { useTenant } from "../context/TenantContext";
import { ShieldCheck, Lock, AlertTriangle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function SecurityView() {
  const { telemetry, activeTenant } = useTenant();

  const chartData = telemetry.map((pt, i) => ({
    time: pt.event_time_utc?.slice(11, 19) || `#${i + 1}`,
    failures: pt.security?.auth_failure_count ?? 0,
    redacted: pt.security?.secrets_redacted_count ?? 0,
  }));

  const totalRedactions = telemetry.reduce((sum, p) => sum + (p.security?.secrets_redacted_count || 0), 0);
  const totalFailures = telemetry.reduce((sum, p) => sum + (p.security?.auth_failure_count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Security Telemetry</h2>
          <p className="text-xs text-slate-400">Failed authentication patterns and local secret redaction proofs</p>
        </div>
      </div>

      {/* Zero PII Guarantee Banner */}
      <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-4">
        <div className="flex items-start space-x-3">
          <ShieldCheck className="h-5 w-5 text-cyan-400 mt-0.5 shrink-0" />
          <div className="text-xs text-slate-300 space-y-1">
            <div className="font-semibold text-cyan-300">Strict Privacy Enforcement Notice</div>
            <p className="text-slate-400">
              Nexus Observe transmits <strong>only counts and risk classifications</strong>.
              Usernames, client IP addresses, passwords, API keys, and session tokens are permanently scrubbed by Tier 1 collectors and never leave the local environment.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-xs text-slate-400 uppercase font-semibold">Total Authentication Failures (Demo Window)</div>
          <div className="text-2xl font-bold text-white mt-2">{totalFailures}</div>
          <div className="text-xs text-slate-500 mt-1">Aggregated without storing target usernames or IPs</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-xs text-slate-400 uppercase font-semibold">Secrets Redacted Locally</div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{totalRedactions}</div>
          <div className="text-xs text-slate-500 mt-1">Regex redactor removed secrets prior to egress</div>
        </div>
      </div>

      {/* Auth Failure Chart */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Auth Failure Frequency (Last Samples)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", fontSize: "11px" }} />
              <Bar dataKey="failures" fill="#f43f5e" name="Auth Failures" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
