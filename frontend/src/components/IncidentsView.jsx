import React from "react";
import { useTenant } from "../context/TenantContext";
import { Sparkles } from "lucide-react";

export default function IncidentsView() {
  const { incidents, alerts, activeTenant } = useTenant();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0c4a3e] tracking-tight">AIOps Incidents & Recommendations</h2>
        <p className="text-xs text-stone-500">Multi-signal correlated incidents with probabilistic explainability</p>
      </div>

      {/* Incident List */}
      <div className="space-y-4">
        {incidents.length > 0 ? (
          incidents.map((inc) => (
            <div key={inc.id} className="rounded-2xl border border-stone-200 bg-white p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                    {inc.severity || "high"}
                  </span>
                  <h3 className="text-base font-bold text-stone-800">{inc.title || "Correlated Incident"}</h3>
                </div>
                <span className="text-xs text-stone-500 font-mono">{inc.started_utc}</span>
              </div>

              {/* Contributing signals */}
              {inc.explanation && (
                <div className="rounded-xl bg-[#f8faf8] border border-stone-200 p-4 space-y-2 text-xs">
                  <div className="flex items-center space-x-1.5 text-[#0c4a3e] font-bold">
                    <Sparkles className="h-4 w-4" />
                    <span>AIOps Correlation Engine Analysis</span>
                  </div>
                  <div className="text-stone-700">
                    <strong>Probable Cause:</strong> {inc.explanation.probable_cause || "Multi-signal threshold deviation"}
                  </div>
                  <div className="text-stone-500">
                    Confidence: <span className="text-[#0c4a3e] font-bold">{Math.round((inc.explanation.confidence || 0.85) * 100)}%</span>
                  </div>
                </div>
              )}

              {/* Recommendation */}
              {inc.recommendation && (
                <div className="rounded-xl bg-[#e7f3ec] border border-[#cbe6d5] p-4 space-y-2 text-xs text-[#0c4a3e]">
                  <div className="font-bold text-sm">Suggested Action</div>
                  <p className="text-stone-800 font-medium">{inc.recommendation.action}</p>
                  {inc.recommendation.rollback_plan && (
                    <div className="text-stone-600">
                      <strong>Rollback Plan:</strong> {inc.recommendation.rollback_plan}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-xs text-stone-500 italic shadow-sm">
            No active correlated incidents for {activeTenant.name}. Anomaly engine is monitoring telemetry streams.
          </div>
        )}
      </div>

      {/* Raw Alerts Table */}
      <div className="mt-8 space-y-3">
        <h3 className="text-base font-bold text-[#0c4a3e]">Active Alerts ({alerts.length})</h3>
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-stone-200 text-left text-xs">
            <thead className="bg-[#f4f7f4] text-stone-600 uppercase font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Context</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Event Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {alerts.length > 0 ? (
                alerts.map((alt) => (
                  <tr key={alt.id} className="hover:bg-stone-50/70">
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {alt.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-700 font-medium">{alt.category}</td>
                    <td className="py-3 px-4 text-stone-800 font-semibold">{alt.context}</td>
                    <td className="py-3 px-4 font-mono text-stone-500">{alt.source_id}</td>
                    <td className="py-3 px-4 font-mono text-stone-400">{alt.event_time_utc}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-stone-500 italic">
                    Zero alerts currently raised.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
