import React from "react";
import { useTenant } from "../context/TenantContext";
import { useBackendHealth } from "../utils/backendHealth";
import {
  Activity,
  ShieldCheck,
  Server,
  AlertCircle,
  RefreshCw,
  LogOut,
  Building,
  User,
} from "lucide-react";

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, activeTenant, logout, listenerStatus, lastDataTimestamp } = useTenant();
  const { status: backendStatus, details: backendDetails, latencyMs, checkHealth } = useBackendHealth();

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
          {/* Logo & Platform Info */}
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

          {/* Right Status Controls */}
          <div className="flex items-center space-x-3">
            {/* Backend Connectivity Status Pill */}
            <div
              onClick={checkHealth}
              title={`FastAPI Server: ${backendStatus} • Click to recheck`}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition shadow-sm ${
                backendStatus === "online"
                  ? "bg-[#e7f3ec] border-[#cbe6d5] text-[#0c4a3e] hover:bg-[#d8edd0]"
                  : backendStatus === "checking"
                  ? "bg-stone-100 border-stone-200 text-stone-600"
                  : "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  backendStatus === "online"
                    ? "bg-emerald-600 animate-pulse"
                    : backendStatus === "checking"
                    ? "bg-amber-400"
                    : "bg-rose-500"
                }`}
              />
              <span>
                Backend: {backendStatus === "online" ? `Online (${latencyMs ?? 10}ms)` : backendStatus === "checking" ? "Checking..." : "Offline"}
              </span>
              <RefreshCw className="h-3 w-3 opacity-60 ml-0.5 hover:rotate-180 transition-transform duration-500" />
            </div>

            {/* Firestore Live Stream Pill */}
            <div className="hidden sm:flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-600">
              <span className={`inline-block h-2 w-2 rounded-full ${listenerStatus === "live" ? "bg-emerald-600 animate-pulse" : "bg-amber-400"}`} />
              <span className="font-medium">
                Firestore: {listenerStatus === "live" ? "Live Stream" : "Connecting"}
              </span>
            </div>

            {/* Tenant Claim Badge (No manual switch) */}
            {activeTenant && (
              <div className="flex items-center space-x-2 bg-[#f8faf8] px-3 py-1.5 rounded-xl border border-stone-200 shadow-sm">
                <Building className="h-3.5 w-3.5 text-[#0c4a3e]" />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-[#0c4a3e] leading-tight">
                    {activeTenant.name}
                  </span>
                  <span className="text-[10px] text-stone-400 font-mono leading-none">
                    {activeTenant.id}
                  </span>
                </div>
              </div>
            )}

            {/* User & Logout Button */}
            {user && (
              <div className="flex items-center space-x-2 pl-1">
                <div className="hidden lg:flex items-center space-x-1 text-xs text-stone-600 bg-stone-50 px-2.5 py-1.5 rounded-xl border border-stone-200">
                  <User className="h-3.5 w-3.5 text-stone-400" />
                  <span className="font-medium">{user.email}</span>
                </div>
                <button
                  onClick={logout}
                  title="Sign out of Nexus Observe"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-stone-700 text-xs font-semibold transition shadow-sm"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            )}
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
