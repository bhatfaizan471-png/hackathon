import React from "react";
import { useTenant } from "../context/TenantContext";
import { calculateStaleness } from "../utils/staleness";
import { Server, AlertCircle } from "lucide-react";

export default function FleetTable() {
  const { collectors, activeTenant } = useTenant();

  const healthBadge = (state) => {
    switch (state?.toLowerCase()) {
      case "excellent":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/40">Excellent</span>;
      case "good":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950 text-blue-400 border border-blue-800/40">Good</span>;
      case "fair":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-400 border border-amber-800/40">Fair</span>;
      case "poor":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950 text-rose-400 border border-rose-800/40">Poor</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400">Unknown</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Fleet Inventory</h2>
          <p className="text-xs text-slate-400">Registered collectors for {activeTenant.name}</p>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          {collectors.length} host(s) reporting
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl">
        <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase font-semibold tracking-wider">
            <tr>
              <th className="py-3 px-4">Collector / Host</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Service</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Health State</th>
              <th className="py-3 px-4">CPU / RAM</th>
              <th className="py-3 px-4">Queue Buffer</th>
              <th className="py-3 px-4">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {collectors.length > 0 ? (
              collectors.map((col) => {
                const staleness = calculateStaleness(col.last_seen_utc, col.health_state || "good");
                const isOffline = col.status === "offline" || staleness.isStale && staleness.effectiveState === "poor";

                return (
                  <tr key={col.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-200">{col.id}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{col.source_id}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-medium">
                      {col.source_role?.replace("_", " ") || "unknown"}
                    </td>
                    <td className="py-3 px-4">
                      {col.customer_facing ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                          {col.customer_facing}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span className={`h-2 w-2 rounded-full ${isOffline ? "bg-rose-500" : "bg-emerald-400"}`} />
                        <span className={isOffline ? "text-rose-400" : "text-emerald-400 font-medium"}>
                          {isOffline ? "offline" : "online"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {healthBadge(staleness.effectiveState)}
                        {staleness.isStale && (
                          <div className="text-[10px] text-amber-400 font-mono">
                            {staleness.reason}
                          </div>
                        )}
                        {col.health_reasons?.length > 0 && !staleness.isStale && (
                          <div className="text-[10px] text-slate-400 max-w-xs truncate">
                            {col.health_reasons[0]}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono">
                      {col.cpu_percent != null ? `${col.cpu_percent}%` : "—"} / {col.memory_percent != null ? `${col.memory_percent}%` : "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono">
                      {col.buffer_depth != null ? col.buffer_depth : 0}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {col.last_seen_utc || "Never"}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                  No collectors registered yet for this tenant. Run the seed script or start a simulated collector.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
