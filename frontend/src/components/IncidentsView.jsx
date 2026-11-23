import React from "react";
import { useTenant } from "../context/TenantContext";
import { Sparkles, AlertCircle } from "lucide-react";

export default function IncidentsView() {
  const { incidents, alerts, activeTenant } = useTenant();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#1c382b] tracking-tight">AIOps Incidents & Recommendations</h2>
        <p className="text-xs text-[#756449]">Multi-signal correlated incidents with probabilistic explainability</p>
      </div>

      {/* Incident List */}
      <div className="space-y-4">
        {incidents.length > 0 ? (
          incidents.map((inc) => (
            <div key={inc.id} className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-6 space-y-4 shadow-xs card-hover border-l-4 border-l-[#9c4242]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span className="flex items-center space-x-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-live-beacon-rose" />
                    <span>{inc.severity || "high"}</span>
                  </span>
                  <h3 className="text-base font-bold text-[#24221f]">{inc.title || "Correlated Incident"}</h3>
                </div>
                <span className="text-xs text-[#756449] font-mono">{inc.started_utc}</span>
              </div>

              {/* Contributing signals */}
              {inc.explanation && (
                <div className="rounded-2xl bg-gradient-to-br from-[#f5f0e6] to-[#edf3ee] border border-[#ded2be] p-4 space-y-2 text-xs">
                  <div className="flex items-center space-x-1.5 text-[#1c382b] font-bold">
                    <Sparkles className="h-4 w-4 text-[#37543e] animate-pulse" />
                    <span>AIOps Correlation Engine Analysis</span>
                  </div>
                  <div className="text-[#362d20]">
                    <strong>Probable Cause:</strong> {inc.explanation.probable_cause || "Multi-signal threshold deviation"}
                  </div>
                  <div className="text-[#756449]">
                    Confidence: <span className="text-[#1c382b] font-bold">{Math.round((inc.explanation.confidence || 0.85) * 100)}%</span>
                  </div>
                </div>
              )}

              {/* Recommendation */}
              {inc.recommendation && (
                <div className="rounded-2xl bg-[#e6ede7] border border-[#cbdccf] p-4 space-y-2 text-xs text-[#1c382b]">
                  <div className="font-bold text-sm">Suggested Action</div>
                  <p className="text-[#24221f] font-medium">{inc.recommendation.action}</p>
                  {inc.recommendation.rollback_plan && (
                    <div className="text-[#544733]">
                      <strong>Rollback Plan:</strong> {inc.recommendation.rollback_plan}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-8 text-center text-xs text-[#756449] italic shadow-xs">
            No active correlated incidents for {activeTenant.name}. Anomaly engine is monitoring telemetry streams.
          </div>
        )}
      </div>

      {/* Raw Alerts Table */}
      <div className="mt-8 space-y-3">
        <h3 className="text-base font-bold text-[#1c382b]">Active Alerts ({alerts.length})</h3>
        <div className="overflow-hidden rounded-3xl border border-[#e5dec9] bg-[#faf7f2] shadow-xs card-hover">
          <table className="min-w-full divide-y divide-[#eee8dc] text-left text-xs">
            <thead className="bg-[#f4efe6] text-[#756449] uppercase font-bold tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Context</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Event Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0eae0]">
              {alerts.length > 0 ? (
                alerts.map((alt) => (
                  <tr key={alt.id} className="hover:bg-[#f2ece1]/60 transition-colors">
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-xl text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {alt.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#544733] font-medium">{alt.category}</td>
                    <td className="py-3 px-4 text-[#24221f] font-semibold">{alt.context}</td>
                    <td className="py-3 px-4 font-mono text-[#756449]">{alt.source_id}</td>
                    <td className="py-3 px-4 font-mono text-[#968262]">{alt.event_time_utc}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#756449] italic">
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
