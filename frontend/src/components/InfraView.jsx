import React from "react";
import { useTenant } from "../context/TenantContext";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";

export default function InfraView() {
  const { telemetry, activeTenant } = useTenant();

  const chartData = telemetry.map((pt, i) => ({
    time: pt.event_time_utc?.slice(11, 19) || `#${i + 1}`,
    cpu: pt.metrics?.cpu_percent ?? 0,
    memory: pt.metrics?.memory_percent ?? 0,
    disk: pt.metrics?.disk_percent ?? 0,
    source: pt.source_id,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Infrastructure Telemetry</h2>
          <p className="text-xs text-slate-400">Live CPU, RAM, and Disk utilization for {activeTenant.name}</p>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          {telemetry.length} time-series samples
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU Chart with Threshold Band */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200">CPU Utilization (%)</h3>
            <span className="text-[10px] text-amber-400 font-mono">Fair: &gt;75% | Poor: &gt;90%</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", fontSize: "11px" }} />
                <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "Fair (75%)", fill: "#f59e0b", fontSize: 10 }} />
                <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Poor (90%)", fill: "#ef4444", fontSize: 10 }} />
                <Line type="monotone" dataKey="cpu" stroke="#06b6d4" strokeWidth={2} dot={false} name="CPU %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory & Disk Chart */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200">Memory & Disk (%)</h3>
            <span className="text-[10px] text-amber-400 font-mono">Mem Fair: &gt;80%</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", fontSize: "11px" }} />
                <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="memory" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Memory %" />
                <Line type="monotone" dataKey="disk" stroke="#10b981" strokeWidth={2} dot={false} name="Disk %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
