import React from "react";
import { useTenant } from "../context/TenantContext";
import { AlertCircle, CheckCircle, ChevronRight, Sparkles } from "lucide-react";

export default function IncidentsView() {
  const { incidents, alerts, activeTenant } = useTenant();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">AIOps Incidents & Recommendations</h2>
          <p className="text-xs text-slate-400">Multi-signal correlated incidents with probabilistic explainability</p>
        </div>
      </div>

      {/* Incident List */}
      <div className="space-y-4">
        {incidents.length > 0 ? (
          incidents.map((inc) => (
            <div key={inc.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950 text-rose-400 border border-rose-800/40">
                    {inc.severity || "high"}
                  </span>
                  <h3 className="text-sm font-bold text-white">{inc.title || "Correlated Incident"}</h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">{inc.started_utc}</span>
              </div>

              {/* Contributing signals */}
              {inc.explanation && (
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3 space-y-2 text-xs">
                  <div className="flex items-center space-x-1.5 text-cyan-400 font-semibold">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>AIOps Correlation Engine Analysis</span>
                  </div>
                  <div className="text-slate-300">
                    <strong>Probable Cause:</strong> {inc.explanation.probable_cause || "Multi-signal threshold deviation"}
                  </div>
                  <div className="text-slate-400">
                    Confidence: <span className="text-slate-200 font-mono">{Math.round((inc.explanation.confidence || 0.85) * 100)}%</span>
                  </div>
                </div>
              )}

              {/* Recommendation */}
              {inc.recommendation && (
                <div className="rounded-lg bg-emerald-950/20 border border-emerald-900/40 p-3 space-y-2 text-xs">
                  <div className="font-semibold text-emerald-400">Suggested Action</div>
                  <p className="text-slate-300">{inc.recommendation.action}</p>
                  {inc.recommendation.rollback_plan && (
                    <div className="text-slate-400">
                      <strong>Rollback Plan:</strong> {inc.recommendation.rollback_plan}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-8 text-center text-xs text-slate-500 italic">
            No active correlated incidents for {activeTenant.name}. Anomaly engine is monitoring telemetry streams.
          </div>
        )}
      </div>

      {/* Raw Alerts Table */}
      <div className="mt-8 space-y-3">
        <h3 className="text-sm font-semibold text-white">Active Alerts ({alerts.length})</h3>
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-4">Severity</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Context</th>
                <th className="py-2.5 px-4">Source</th>
                <th className="py-2.5 px-4">Event Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {alerts.length > 0 ? (
                alerts.map((alt) => (
                  <tr key={alt.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950 text-amber-400 border border-amber-800/40">
                        {alt.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">{alt.category}</td>
                    <td className="py-2.5 px-4 text-slate-200 font-medium">{alt.context}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">{alt.source_id}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{alt.event_time_utc}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500 italic">
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
