import React from "react";
import { useTenant } from "../context/TenantContext";

export default function HealthHistoryView() {
  const { healthHistory, activeTenant } = useTenant();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#0c4a3e] tracking-tight">Health History Log</h2>
        <p className="text-xs text-stone-500">Recorded transitions between health states for {activeTenant.name}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-stone-200 text-left text-xs">
          <thead className="bg-[#f4f7f4] text-stone-600 uppercase font-bold tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Timestamp (UTC)</th>
              <th className="py-3.5 px-4">Source ID</th>
              <th className="py-3.5 px-4">Transition</th>
              <th className="py-3.5 px-4">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {healthHistory.length > 0 ? (
              healthHistory.map((evt) => (
                <tr key={evt.id} className="hover:bg-stone-50/70">
                  <td className="py-3.5 px-4 font-mono text-stone-500">{evt.time_utc}</td>
                  <td className="py-3.5 px-4 font-mono text-[#0c4a3e] font-semibold">{evt.source_id}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-stone-700">{evt.from_state}</span>
                    <span className="text-stone-400 mx-2">→</span>
                    <span className={`font-bold ${evt.to_state === "poor" ? "text-rose-600" : "text-amber-600"}`}>
                      {evt.to_state}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-stone-700 font-medium">{evt.reason}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-stone-500 italic">
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
