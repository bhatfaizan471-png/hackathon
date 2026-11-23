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
          <h2 className="text-xl font-bold text-[#1c382b] tracking-tight">Infrastructure Telemetry</h2>
          <p className="text-xs text-[#756449]">Live CPU, RAM, and Disk utilization for {activeTenant.name}</p>
        </div>
        <div className="text-xs text-[#544733] font-semibold bg-[#faf7f2] border border-[#e5dec9] px-3 py-1.5 rounded-2xl shadow-2xs">
          {telemetry.length} time-series samples
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU Chart with Threshold Band */}
        <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-6 shadow-xs card-hover border-t-4 border-t-[#37543e]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#1c382b]">CPU Utilization (%)</h3>
            <span className="text-[10px] text-[#756449] font-mono font-medium">Fair: &gt;75% | Poor: &gt;90%</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d5" />
                <XAxis dataKey="time" stroke="#756449" tick={{ fontSize: 10 }} />
                <YAxis stroke="#756449" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#faf7f2", borderColor: "#ded2be", borderRadius: "12px", fontSize: "11px", boxShadow: "0 4px 6px rgba(0,0,0,0.04)" }} />
                <ReferenceLine y={75} stroke="#b59351" strokeDasharray="3 3" label={{ value: "Fair (75%)", fill: "#8f6b28", fontSize: 10 }} />
                <ReferenceLine y={90} stroke="#9c4242" strokeDasharray="3 3" label={{ value: "Poor (90%)", fill: "#9c4242", fontSize: 10 }} />
                <Line type="monotone" dataKey="cpu" stroke="#1c382b" strokeWidth={2.5} dot={false} name="CPU %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory & Disk Chart */}
        <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-6 shadow-xs card-hover border-t-4 border-t-[#60896a]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#1c382b]">Memory & Disk (%)</h3>
            <span className="text-[10px] text-[#756449] font-mono font-medium">Mem Fair: &gt;80%</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d5" />
                <XAxis dataKey="time" stroke="#756449" tick={{ fontSize: 10 }} />
                <YAxis stroke="#756449" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#faf7f2", borderColor: "#ded2be", borderRadius: "12px", fontSize: "11px", boxShadow: "0 4px 6px rgba(0,0,0,0.04)" }} />
                <ReferenceLine y={80} stroke="#b59351" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="memory" stroke="#37543e" strokeWidth={2} dot={false} name="Memory %" />
                <Line type="monotone" dataKey="disk" stroke="#72614b" strokeWidth={2} dot={false} name="Disk %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
