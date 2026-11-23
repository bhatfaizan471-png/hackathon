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
        <h2 className="text-xl font-bold text-[#1c382b] tracking-tight">Security Telemetry</h2>
        <p className="text-xs text-[#756449]">Failed authentication patterns and local secret redaction proofs</p>
      </div>

      {/* Zero PII Guarantee Banner */}
      <div className="rounded-3xl border border-[#cbdccf] bg-[#e6ede7] p-5 shadow-xs">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 rounded-2xl bg-[#faf7f2] text-[#1c382b] border border-[#cbdccf] shadow-2xs">
            <ShieldCheck className="h-5 w-5 text-[#37543e]" />
          </div>
          <div className="text-xs text-[#24221f] space-y-1">
            <div className="font-bold text-[#1c382b] text-sm">Strict Privacy Enforcement Notice</div>
            <p className="text-[#544733] leading-relaxed">
              Nexus Observe transmits <strong>only counts and risk classifications</strong>.
              Usernames, client IP addresses, passwords, API keys, and session tokens are permanently scrubbed by Tier 1 collectors and never leave the local environment.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-6 shadow-xs card-hover border-t-4 border-t-[#b59351]">
          <div className="text-xs text-[#756449] uppercase font-bold tracking-wider">Total Authentication Failures</div>
          <div className="text-3xl font-extrabold text-[#24221f] mt-2">{totalFailures}</div>
          <div className="text-xs text-[#756449] mt-1">Aggregated without storing target usernames or IPs</div>
        </div>

        <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-6 shadow-xs card-hover border-t-4 border-t-[#37543e]">
          <div className="text-xs text-[#756449] uppercase font-bold tracking-wider">Secrets Redacted Locally</div>
          <div className="text-3xl font-extrabold text-[#1c382b] mt-2">{totalRedactions}</div>
          <div className="text-xs text-[#756449] mt-1">Regex redactor removed secrets prior to egress</div>
        </div>
      </div>

      {/* Auth Failure Chart */}
      <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-6 shadow-xs card-hover">
        <h3 className="text-sm font-bold text-[#1c382b] mb-4">Auth Failure Frequency (Last Samples)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d5" />
              <XAxis dataKey="time" stroke="#756449" tick={{ fontSize: 10 }} />
              <YAxis stroke="#756449" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: "#faf7f2", borderColor: "#ded2be", borderRadius: "12px", fontSize: "11px", boxShadow: "0 4px 6px rgba(0,0,0,0.04)" }} />
              <Bar dataKey="failures" fill="#1c382b" radius={[6, 6, 0, 0]} name="Auth Failures" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
