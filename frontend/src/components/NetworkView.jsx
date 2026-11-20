import React from "react";
import { useTenant } from "../context/TenantContext";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function NetworkView() {
  const { telemetry, activeTenant } = useTenant();

  const chartData = telemetry.map((pt, i) => ({
    time: pt.event_time_utc?.slice(11, 19) || `#${i + 1}`,
    latency: pt.metrics?.net_latency_ms ?? 0,
    loss: pt.metrics?.packet_loss_percent ?? 0,
    bandwidthIn: pt.metrics?.bandwidth_in_kbps ?? 0,
    bandwidthOut: pt.metrics?.bandwidth_out_kbps ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0c4a3e] tracking-tight">Network Health & Latency</h2>
        <p className="text-xs text-stone-500">Ping latency, packet loss, and ingress/egress bandwidth</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency & Packet Loss */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-[#0c4a3e] mb-4">Ping Latency (ms)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "8px", fontSize: "11px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }} />
                <Line type="monotone" dataKey="latency" stroke="#0c4a3e" strokeWidth={2.5} dot={false} name="Latency (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bandwidth Throughput */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-[#0c4a3e] mb-4">Throughput (kbps)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "8px", fontSize: "11px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }} />
                <Line type="monotone" dataKey="bandwidthIn" stroke="#059669" strokeWidth={2} dot={false} name="In (kbps)" />
                <Line type="monotone" dataKey="bandwidthOut" stroke="#0284c7" strokeWidth={2} dot={false} name="Out (kbps)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
