import React from "react";
import { useTenant } from "../context/TenantContext";

export default function HealthHistoryView() {
  const { healthHistory, activeTenant } = useTenant();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Health History Log</h2>
        <p className="text-xs text-slate-400">Recorded transitions between health states for {activeTenant.name}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl">
        <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase font-semibold">
            <tr>
              <th className="py-3 px-4">Timestamp (UTC)</th>
              <th className="py-3 px-4">Source ID</th>
              <th className="py-3 px-4">Transition</th>
              <th className="py-3 px-4">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {healthHistory.length > 0 ? (
              healthHistory.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-mono text-slate-400">{evt.time_utc}</td>
                  <td className="py-3 px-4 font-mono text-slate-300">{evt.source_id}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-300">{evt.from_state}</span>
                    <span className="text-slate-500 mx-1.5">→</span>
                    <span className={`font-semibold ${evt.to_state === "poor" ? "text-rose-400" : "text-amber-400"}`}>
                      {evt.to_state}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{evt.reason}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500 italic">
                  No health transition events recorded yet. Transitions occur when heartbeats lag &gt;15s or collectors drop offline.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
