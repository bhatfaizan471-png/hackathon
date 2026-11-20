import React from "react";
import { useTenant } from "../context/TenantContext";
import { calculateStaleness } from "../utils/staleness";

export default function FleetTable() {
  const { collectors, activeTenant } = useTenant();

  const healthBadge = (state) => {
    switch (state?.toLowerCase()) {
      case "excellent":
      case "good":
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#e7f3ec] text-[#0c4a3e] border border-[#cbe6d5]">{state}</span>;
      case "fair":
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Fair</span>;
      case "poor":
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">Poor</span>;
      default:
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-stone-100 text-stone-600">Unknown</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0c4a3e] tracking-tight">Fleet Inventory</h2>
          <p className="text-xs text-stone-500">Connected metadata collectors for {activeTenant.name}</p>
        </div>
        <div className="text-xs text-stone-600 font-semibold bg-white border border-stone-200 px-3 py-1.5 rounded-xl shadow-sm">
          {collectors.length} host(s) reporting
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-stone-200 text-left text-xs">
          <thead className="bg-[#f4f7f4] text-stone-600 uppercase font-bold tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Collector / Host</th>
              <th className="py-3.5 px-4">Role</th>
              <th className="py-3.5 px-4">Service</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Health State</th>
              <th className="py-3.5 px-4">CPU / RAM</th>
              <th className="py-3.5 px-4">Queue Buffer</th>
              <th className="py-3.5 px-4">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {collectors.length > 0 ? (
              collectors.map((col) => {
                const staleness = calculateStaleness(col.last_seen_utc, col.health_state || "good");
                const isOffline = col.status === "offline" || (staleness.isStale && staleness.effectiveState === "poor");

                return (
                  <tr key={col.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-stone-800">{col.id}</div>
                      <div className="text-[10px] text-stone-400 font-mono">{col.source_id}</div>
                    </td>
                    <td className="py-3.5 px-4 text-stone-700 font-medium">
                      {col.source_role?.replace("_", " ") || "unknown"}
                    </td>
                    <td className="py-3.5 px-4">
                      {col.customer_facing ? (
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#e7f3ec] text-[#0c4a3e] border border-[#cbe6d5]">
                          {col.customer_facing}
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${isOffline ? "bg-rose-500" : "bg-emerald-600"}`} />
                        <span className={`font-semibold ${isOffline ? "text-rose-600" : "text-emerald-700"}`}>
                          {isOffline ? "offline" : "online"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        {healthBadge(staleness.effectiveState)}
                        {staleness.isStale && (
                          <div className="text-[10px] text-amber-700 font-semibold">
                            {staleness.reason}
                          </div>
                        )}
                        {col.health_reasons?.length > 0 && !staleness.isStale && (
                          <div className="text-[10px] text-stone-500 max-w-xs truncate">
                            {col.health_reasons[0]}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-stone-700 font-mono font-medium">
                      {col.cpu_percent != null ? `${col.cpu_percent}%` : "—"} / {col.memory_percent != null ? `${col.memory_percent}%` : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-stone-700 font-mono font-medium">
                      {col.buffer_depth != null ? col.buffer_depth : 0}
                    </td>
                    <td className="py-3.5 px-4 text-stone-500 font-mono text-[11px]">
                      {col.last_seen_utc || "Never"}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center text-stone-500 italic">
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
