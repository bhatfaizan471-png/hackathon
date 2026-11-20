import React from "react";
import { useTenant, TENANTS } from "../context/TenantContext";
import { Activity, ShieldCheck, Server, AlertCircle, RefreshCw } from "lucide-react";

export default function Navbar({ activeTab, setActiveTab }) {
  const { activeTenant, setActiveTenant, listenerStatus, lastDataTimestamp } = useTenant();

  const tabs = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "fleet", label: "Fleet", icon: Server },
    { id: "infra", label: "Infrastructure", icon: Server },
    { id: "network", label: "Network", icon: Activity },
    { id: "app", label: "Application", icon: Server },
    { id: "security", label: "Security", icon: ShieldCheck },
    { id: "incidents", label: "Incidents & AIOps", icon: AlertCircle },
    { id: "history", label: "Health History", icon: RefreshCw },
    { id: "egress", label: "Egress Proof", icon: ShieldCheck },
  ];

  return (
    <header className="border-b border-stone-200 bg-white/95 backdrop-blur sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Info matching the green theme */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-[#0c4a3e] flex items-center justify-center shadow-md shadow-[#0c4a3e]/15">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-[#0c4a3e] text-lg tracking-tight">Nexus Observe</span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#e7f3ec] text-[#0c4a3e] border border-[#cbe6d5]">
                  AIOps Tier 2
                </span>
              </div>
              <p className="text-xs text-stone-500 font-medium">Privacy-First Two-Tier Observability</p>
            </div>
          </div>

          {/* Tenant Selector & Connection Status */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${listenerStatus === "live" ? "bg-emerald-600 animate-pulse" : "bg-amber-500"}`} />
              <span className="text-stone-600 font-medium">
                {listenerStatus === "live" ? "Live Stream" : "Connecting..."}
                {lastDataTimestamp && ` (${lastDataTimestamp})`}
              </span>
            </div>

            <div className="flex items-center space-x-2 bg-stone-50 p-1.5 rounded-xl border border-stone-200">
              <span className="text-xs text-stone-500 font-medium pl-2">Tenant:</span>
              <select
                value={activeTenant.id}
                onChange={(e) => {
                  const t = TENANTS.find((x) => x.id === e.target.value);
                  if (t) setActiveTenant(t);
                }}
                className="bg-white text-xs text-stone-800 border border-stone-300 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#0c4a3e] font-semibold cursor-pointer shadow-sm"
              >
                {TENANTS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1.5 overflow-x-auto py-2.5 scrollbar-none border-t border-stone-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-[#0c4a3e] text-white shadow-sm shadow-[#0c4a3e]/20"
                    : "text-stone-600 hover:text-[#0c4a3e] hover:bg-[#e7f3ec]/60"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
