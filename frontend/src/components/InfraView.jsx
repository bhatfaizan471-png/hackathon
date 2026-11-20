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
          <h2 className="text-xl font-bold text-[#0c4a3e] tracking-tight">Infrastructure Telemetry</h2>
          <p className="text-xs text-stone-500">Live CPU, RAM, and Disk utilization for {activeTenant.name}</p>
        </div>
        <div className="text-xs text-stone-600 font-semibold bg-white border border-stone-200 px-3 py-1.5 rounded-xl shadow-sm">
          {telemetry.length} time-series samples
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU Chart with Threshold Band */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#0c4a3e]">CPU Utilization (%)</h3>
            <span className="text-[10px] text-stone-500 font-mono font-medium">Fair: &gt;75% | Poor: &gt;90%</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "8px", fontSize: "11px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }} />
                <ReferenceLine y={75} stroke="#d97706" strokeDasharray="3 3" label={{ value: "Fair (75%)", fill: "#d97706", fontSize: 10 }} />
                <ReferenceLine y={90} stroke="#dc2626" strokeDasharray="3 3" label={{ value: "Poor (90%)", fill: "#dc2626", fontSize: 10 }} />
                <Line type="monotone" dataKey="cpu" stroke="#0c4a3e" strokeWidth={2.5} dot={false} name="CPU %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory & Disk Chart */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#0c4a3e]">Memory & Disk (%)</h3>
            <span className="text-[10px] text-stone-500 font-mono font-medium">Mem Fair: &gt;80%</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "8px", fontSize: "11px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }} />
                <ReferenceLine y={80} stroke="#d97706" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="memory" stroke="#059669" strokeWidth={2} dot={false} name="Memory %" />
                <Line type="monotone" dataKey="disk" stroke="#0284c7" strokeWidth={2} dot={false} name="Disk %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
