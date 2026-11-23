import React, { useState } from "react";
import { useTenant } from "../context/TenantContext";
import { calculateStaleness } from "../utils/staleness";
import { Search } from "lucide-react";

export default function FleetTable() {
  const { collectors, activeTenant } = useTenant();
  const [filterQuery, setFilterQuery] = useState("");

  const healthBadge = (state) => {
    switch (state?.toLowerCase()) {
      case "excellent":
      case "good":
        return (
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[#e6ede7] text-[#1c382b] border border-[#cbdccf] shadow-2xs">
            {state}
          </span>
        );
      case "fair":
        return (
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            Fair
          </span>
        );
      case "poor":
        return (
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            Poor
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[#f4efe6] text-[#756449] border border-[#ded2be]">
            Unknown
          </span>
        );
    }
  };

  const filtered = collectors.filter((c) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      c.id?.toLowerCase().includes(q) ||
      c.source_id?.toLowerCase().includes(q) ||
      c.source_role?.toLowerCase().includes(q) ||
      c.customer_facing?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1c382b] tracking-tight">Fleet Inventory</h2>
          <p className="text-xs text-[#756449]">Connected metadata collectors for {activeTenant.name}</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#968262]">
              <Search className="h-3.5 w-3.5" />
            </div>
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search hosts..."
              className="pl-8 pr-3 py-1.5 text-xs bg-[#faf7f2] border border-[#ded2be] rounded-2xl text-[#24221f] placeholder-[#b5a281] focus:outline-none focus:ring-2 focus:ring-[#37543e]/20 focus:border-[#37543e] font-medium"
            />
          </div>
          <div className="text-xs text-[#544733] font-semibold bg-[#faf7f2] border border-[#e5dec9] px-3 py-1.5 rounded-2xl shadow-2xs whitespace-nowrap">
            {filtered.length} of {collectors.length} host(s)
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-[#e5dec9] bg-[#faf7f2] shadow-xs card-hover">
        <table className="min-w-full divide-y divide-[#eee8dc] text-left text-xs">
          <thead className="bg-[#f4efe6] text-[#756449] uppercase font-bold tracking-wider text-[11px]">
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
          <tbody className="divide-y divide-[#f0eae0]">
            {filtered.length > 0 ? (
              filtered.map((col) => {
                const staleness = calculateStaleness(col.last_seen_utc, col.health_state || "good", col.observed_interval_s ?? 5);
                const isOffline = col.status === "offline" || (staleness.isStale && staleness.effectiveState === "poor");

                return (
                  <tr key={col.id} className="hover:bg-[#f2ece1]/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#1c382b]">{col.id}</div>
                      <div className="text-[10px] text-[#756449] font-mono">{col.source_id}</div>
                    </td>
                    <td className="py-3.5 px-4 text-[#544733] font-medium">
                      {col.source_role?.replace("_", " ") || "unknown"}
                    </td>
                    <td className="py-3.5 px-4">
                      {col.customer_facing ? (
                        <span className="px-2.5 py-0.5 rounded-xl text-[10px] font-semibold bg-[#e6ede7] text-[#1c382b] border border-[#cbdccf] shadow-2xs">
                          {col.customer_facing}
                        </span>
                      ) : (
                        <span className="text-[#b5a281]">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${isOffline ? "bg-rose-500 animate-live-beacon-rose" : "bg-[#37543e] animate-live-beacon"}`} />
                        <span className={`font-semibold ${isOffline ? "text-rose-700" : "text-[#1c382b]"}`}>
                          {isOffline ? "offline" : "online"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        {healthBadge(staleness.effectiveState)}
                        {staleness.isStale && (
                          <div className="text-[10px] text-amber-800 font-semibold">
                            {staleness.reason}
                          </div>
                        )}
                        {col.health_reasons?.length > 0 && !staleness.isStale && (
                          <div className="text-[10px] text-[#756449] max-w-xs truncate font-medium">
                            {col.health_reasons[0]}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#24221f] font-mono font-medium">
                      {col.cpu_percent != null ? `${col.cpu_percent}%` : "—"} / {col.memory_percent != null ? `${col.memory_percent}%` : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-[#24221f] font-mono font-medium">
                      {col.buffer_depth != null ? col.buffer_depth : 0}
                    </td>
                    <td className="py-3.5 px-4 text-[#756449] font-mono text-[11px]">
                      {col.last_seen_utc || "Never"}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#756449] italic">
                  {filterQuery ? "No collectors match your search query." : "No collectors registered yet for this tenant."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
