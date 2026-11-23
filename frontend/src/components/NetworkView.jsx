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
        <h2 className="text-xl font-bold text-[#1c382b] tracking-tight">Network Health & Latency</h2>
        <p className="text-xs text-[#756449]">Ping latency, packet loss, and ingress/egress bandwidth</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency & Packet Loss */}
        <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-6 shadow-xs card-hover border-t-4 border-t-[#1c382b]">
          <h3 className="text-sm font-bold text-[#1c382b] mb-4">Ping Latency (ms)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d5" />
                <XAxis dataKey="time" stroke="#756449" tick={{ fontSize: 10 }} />
                <YAxis stroke="#756449" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#faf7f2", borderColor: "#ded2be", borderRadius: "12px", fontSize: "11px", boxShadow: "0 4px 6px rgba(0,0,0,0.04)" }} />
                <Line type="monotone" dataKey="latency" stroke="#1c382b" strokeWidth={2.5} dot={false} name="Latency (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bandwidth Throughput */}
        <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-6 shadow-xs card-hover border-t-4 border-t-[#60896a]">
          <h3 className="text-sm font-bold text-[#1c382b] mb-4">Throughput (kbps)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d5" />
                <XAxis dataKey="time" stroke="#756449" tick={{ fontSize: 10 }} />
                <YAxis stroke="#756449" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#faf7f2", borderColor: "#ded2be", borderRadius: "12px", fontSize: "11px", boxShadow: "0 4px 6px rgba(0,0,0,0.04)" }} />
                <Line type="monotone" dataKey="bandwidthIn" stroke="#37543e" strokeWidth={2} dot={false} name="In (kbps)" />
                <Line type="monotone" dataKey="bandwidthOut" stroke="#72614b" strokeWidth={2} dot={false} name="Out (kbps)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
