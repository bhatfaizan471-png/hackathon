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
    Good: "text-emerald-400 border-emerald-500/30 bg-emerald-950/30",
    Fair: "text-amber-400 border-amber-500/30 bg-amber-950/30",
    Poor: "text-rose-400 border-rose-500/30 bg-rose-950/30",
  };

  return (
    <div className="space-y-6">
      {/* Platform Banner */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {activeTenant.name} Telemetry Hub
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Zero-Trust Metadata Egress: raw log lines, user credentials, and customer data never leave customer boundaries.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold uppercase tracking-wider ${stateColors[overallState]}`}>
              Fleet Health: {overallState}
            </div>
            <button
              onClick={() => onNavigate("egress")}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium shadow-lg shadow-cyan-600/20 transition"
            >
              <span>Verify Egress Proof</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Hosts</span>
            <Server className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">{totalHosts}</span>
            <span className="text-xs text-emerald-400">({onlineCount} online)</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">Autonomous metadata collectors</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Alerts</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">{alerts.length}</span>
            <span className="text-xs text-slate-400">in cooldown window</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">Threshold & EWMA anomaly triggers</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">AIOps Incidents</span>
            <Activity className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">{incidents.length}</span>
            <span className="text-xs text-rose-400">correlated</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">Multi-signal 2-minute clustering</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Privacy Engine</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-emerald-400">100%</span>
            <span className="text-xs text-slate-400">Allow-list compliance</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">0 secrets leaked outside boundary</div>
        </div>
      </div>

      {/* Quick Summary of Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Live Telemetry Snapshot</h3>
          {latestPoint ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Last Received</span>
                <span className="text-slate-200 font-mono">{latestPoint.event_time_utc}</span>
              </div>
              <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Active Source</span>
                <span className="text-slate-200 font-mono">{latestPoint.source_id} ({latestPoint.source_role})</span>
              </div>
              <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800">
                <span className="text-slate-400">CPU / RAM / Disk</span>
                <span className="text-slate-200 font-mono">
                  {latestPoint.metrics?.cpu_percent}% / {latestPoint.metrics?.memory_percent}% / {latestPoint.metrics?.disk_percent}%
                </span>
              </div>
              <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Latency / Packet Loss</span>
                <span className="text-slate-200 font-mono">
                  {latestPoint.metrics?.net_latency_ms} ms / {latestPoint.metrics?.packet_loss_percent}%
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic py-6 text-center">
              Awaiting telemetry from active collectors... Run collector with <code>python -m collector.collector --simulate</code>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Security & Compliance Guard</h3>
          <div className="space-y-3 text-xs">
            <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-950/20 border border-emerald-900/40 p-2.5 rounded-lg">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Allow-list strictly enforces zero sensitive data egress.</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800 text-slate-300">
              <span className="text-slate-400">Redacted Secrets Count</span>
              <span className="font-mono">{latestPoint?.security?.secrets_redacted_count ?? 0} locally scrubbed</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800 text-slate-300">
              <span className="text-slate-400">Failed Logins Tracked</span>
              <span className="font-mono">{latestPoint?.security?.auth_failure_count ?? 0} (count only, no usernames/IPs)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
