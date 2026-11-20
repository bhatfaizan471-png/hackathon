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
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Info */}
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-lg tracking-tight">NEXUS OBSERVE</span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                  AIOps Tier 2
                </span>
              </div>
              <p className="text-xs text-slate-400">Privacy-First Two-Tier Observability</p>
            </div>
          </div>

          {/* Tenant Selector & Connection Status */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs">
              <span className={`inline-block h-2 w-2 rounded-full ${listenerStatus === "live" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span className="text-slate-400">
                {listenerStatus === "live" ? "Live Listener" : "Connecting..."}
                {lastDataTimestamp && ` (${lastDataTimestamp})`}
              </span>
            </div>

            <div className="flex items-center space-x-2 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700">
              <span className="text-xs text-slate-400 pl-2">Tenant:</span>
              <select
                value={activeTenant.id}
                onChange={(e) => {
                  const t = TENANTS.find((x) => x.id === e.target.value);
                  if (t) setActiveTenant(t);
                }}
                className="bg-slate-900 text-xs text-slate-200 border border-slate-700 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-medium cursor-pointer"
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
        <div className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
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
