import React from "react";
import { useTenant } from "../context/TenantContext";

export default function HealthHistoryView() {
  const { healthHistory, activeTenant } = useTenant();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#1c382b] tracking-tight">Health History Log</h2>
        <p className="text-xs text-[#756449]">Recorded transitions between health states for {activeTenant.name}</p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-[#e5dec9] bg-[#faf7f2] shadow-xs card-hover">
        <table className="min-w-full divide-y divide-[#eee8dc] text-left text-xs">
          <thead className="bg-[#f4efe6] text-[#756449] uppercase font-bold tracking-wider text-[11px]">
            <tr>
              <th className="py-3.5 px-4">Timestamp (UTC)</th>
              <th className="py-3.5 px-4">Source ID</th>
              <th className="py-3.5 px-4">Transition</th>
              <th className="py-3.5 px-4">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0eae0]">
            {healthHistory.length > 0 ? (
              healthHistory.map((evt) => (
                <tr key={evt.id} className="hover:bg-[#f2ece1]/60 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-[#756449]">{evt.time_utc}</td>
                  <td className="py-3.5 px-4 font-mono text-[#1c382b] font-semibold">{evt.source_id}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-[#544733]">{evt.from_state}</span>
                    <span className="text-[#b5a281] mx-2 font-bold">→</span>
                    <span className={`font-bold ${evt.to_state === "poor" ? "text-rose-700" : "text-amber-800"}`}>
                      {evt.to_state}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-[#24221f] font-medium">{evt.reason}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[#756449] italic">
                  No health transition events recorded yet. Transitions occur when health state changes or a collector goes Poor after 60s without a heartbeat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
