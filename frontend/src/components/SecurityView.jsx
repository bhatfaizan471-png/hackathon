import React from "react";
import { useTenant } from "../context/TenantContext";
import { ShieldCheck } from "lucide-react";
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
      <div>
        <h2 className="text-xl font-bold text-[#0c4a3e] tracking-tight">Security Telemetry</h2>
        <p className="text-xs text-stone-500">Failed authentication patterns and local secret redaction proofs</p>
      </div>

      {/* Zero PII Guarantee Banner */}
      <div className="rounded-2xl border border-[#cbe6d5] bg-[#e7f3ec] p-5 shadow-sm">
        <div className="flex items-start space-x-3.5">
          <div className="p-2 rounded-xl bg-white text-[#0c4a3e] shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="text-xs text-stone-700 space-y-1">
            <div className="font-bold text-[#0c4a3e] text-sm">Strict Privacy Enforcement Notice</div>
            <p className="text-stone-600 leading-relaxed">
              Nexus Observe transmits <strong>only counts and risk classifications</strong>.
              Usernames, client IP addresses, passwords, API keys, and session tokens are permanently scrubbed by Tier 1 collectors and never leave the local environment.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="text-xs text-stone-500 uppercase font-bold tracking-wider">Total Authentication Failures</div>
          <div className="text-3xl font-extrabold text-stone-800 mt-2">{totalFailures}</div>
          <div className="text-xs text-stone-500 mt-1">Aggregated without storing target usernames or IPs</div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="text-xs text-stone-500 uppercase font-bold tracking-wider">Secrets Redacted Locally</div>
          <div className="text-3xl font-extrabold text-[#0c4a3e] mt-2">{totalRedactions}</div>
          <div className="text-xs text-stone-500 mt-1">Regex redactor removed secrets prior to egress</div>
        </div>
      </div>

      {/* Auth Failure Chart */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-[#0c4a3e] mb-4">Auth Failure Frequency (Last Samples)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "8px", fontSize: "11px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }} />
              <Bar dataKey="failures" fill="#0c4a3e" name="Auth Failures" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
