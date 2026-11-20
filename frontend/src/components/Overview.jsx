import React from "react";
import { useTenant } from "../context/TenantContext";
import { calculateStaleness } from "../utils/staleness";
import { Server, Activity, ShieldCheck, AlertTriangle, ArrowUpRight } from "lucide-react";

export default function Overview({ onNavigate }) {
  const { activeTenant, collectors, telemetry, alerts, incidents } = useTenant();

  const totalHosts = collectors.length;
  let onlineCount = 0;
  let poorCount = 0;
  let fairCount = 0;
  let goodCount = 0;

  collectors.forEach((col) => {
    const st = calculateStaleness(col.last_seen_utc, col.health_state || "good");
    if (col.status === "online" && !st.isStale) onlineCount++;
    if (st.effectiveState === "poor") poorCount++;
    else if (st.effectiveState === "fair") fairCount++;
    else goodCount++;
  });

  const latestPoint = telemetry[telemetry.length - 1];
  const overallState = poorCount > 0 ? "Poor" : fairCount > 0 ? "Fair" : "Good";

  const stateColors = {
    Good: "text-[#0c4a3e] border-[#cbe6d5] bg-[#e7f3ec]",
    Fair: "text-amber-800 border-amber-200 bg-amber-50",
    Poor: "text-rose-800 border-rose-200 bg-rose-50",
  };

  return (
    <div className="space-y-6">
      {/* Platform Banner */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0c4a3e] tracking-tight">
              {activeTenant.name} Telemetry Hub
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              Zero-Trust Metadata Egress: raw log lines, user credentials, and customer data never leave customer boundaries.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider ${stateColors[overallState]}`}>
              Fleet Health: {overallState}
            </div>
            <button
              onClick={() => onNavigate("egress")}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#0c4a3e] hover:bg-[#093a30] text-white text-xs font-semibold shadow-sm transition"
            >
              <span>Verify Egress Proof</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Hosts</span>
            <div className="p-2 rounded-lg bg-[#e7f3ec]">
              <Server className="h-4 w-4 text-[#0c4a3e]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#0c4a3e]">{totalHosts}</span>
            <span className="text-xs font-semibold text-emerald-700">({onlineCount} online)</span>
          </div>
          <div className="mt-2 text-xs text-stone-500">Autonomous metadata collectors</div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Active Alerts</span>
            <div className="p-2 rounded-lg bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-stone-800">{alerts.length}</span>
            <span className="text-xs font-medium text-stone-500">in cooldown</span>
          </div>
          <div className="mt-2 text-xs text-stone-500">Threshold & EWMA anomaly triggers</div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">AIOps Incidents</span>
            <div className="p-2 rounded-lg bg-rose-50">
              <Activity className="h-4 w-4 text-rose-700" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-stone-800">{incidents.length}</span>
            <span className="text-xs font-semibold text-rose-600">correlated</span>
          </div>
          <div className="mt-2 text-xs text-stone-500">Multi-signal 2-minute clustering</div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Privacy Engine</span>
            <div className="p-2 rounded-lg bg-[#e7f3ec]">
              <ShieldCheck className="h-4 w-4 text-[#0c4a3e]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#0c4a3e]">100%</span>
            <span className="text-xs font-medium text-stone-500">Allow-list</span>
          </div>
          <div className="mt-2 text-xs text-stone-500">0 secrets leaked outside boundary</div>
        </div>
      </div>

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-[#0c4a3e] mb-4">Live Telemetry Snapshot</h3>
          {latestPoint ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs py-2 border-b border-stone-100">
                <span className="text-stone-500 font-medium">Last Received</span>
                <span className="text-stone-800 font-mono font-semibold">{latestPoint.event_time_utc}</span>
              </div>
              <div className="flex justify-between items-center text-xs py-2 border-b border-stone-100">
                <span className="text-stone-500 font-medium">Active Source</span>
                <span className="text-[#0c4a3e] font-mono font-semibold">{latestPoint.source_id} ({latestPoint.source_role})</span>
              </div>
              <div className="flex justify-between items-center text-xs py-2 border-b border-stone-100">
                <span className="text-stone-500 font-medium">CPU / RAM / Disk</span>
                <span className="text-stone-800 font-mono font-semibold">
                  {latestPoint.metrics?.cpu_percent}% / {latestPoint.metrics?.memory_percent}% / {latestPoint.metrics?.disk_percent}%
                </span>
              </div>
              <div className="flex justify-between items-center text-xs py-2 border-b border-stone-100">
                <span className="text-stone-500 font-medium">Latency / Packet Loss</span>
                <span className="text-stone-800 font-mono font-semibold">
                  {latestPoint.metrics?.net_latency_ms} ms / {latestPoint.metrics?.packet_loss_percent}%
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-stone-500 italic py-8 text-center bg-stone-50 rounded-xl">
              Awaiting telemetry from active collectors... Run collector with <code>python -m collector.collector --simulate</code>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-[#0c4a3e] mb-4">Security & Compliance Guard</h3>
          <div className="space-y-4 text-xs">
            <div className="flex items-center space-x-2.5 text-[#0c4a3e] bg-[#e7f3ec] border border-[#cbe6d5] p-3.5 rounded-xl font-medium">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <span>Allow-list strictly enforces zero sensitive data egress across all hosts.</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-stone-700">
              <span className="text-stone-500 font-medium">Redacted Secrets Count</span>
              <span className="font-mono font-bold text-[#0c4a3e]">{latestPoint?.security?.secrets_redacted_count ?? 0} locally scrubbed</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-stone-700">
              <span className="text-stone-500 font-medium">Failed Logins Tracked</span>
              <span className="font-mono font-bold text-stone-800">{latestPoint?.security?.auth_failure_count ?? 0} (count only, no usernames/IPs)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
