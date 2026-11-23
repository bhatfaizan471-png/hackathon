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
  Download,
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
    { id: "collector", label: "Get Collector", icon: Download },
  ];

  return (
    <header className="border-b border-[#e5dec9] bg-[#faf7f2]/95 backdrop-blur-md sticky top-0 z-50 shadow-xs">
      <div className="h-0.5 bg-gradient-to-r from-[#1c382b] via-[#60896a] to-[#b5a281] w-full" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Info */}
          <div className="flex items-center space-x-3 group cursor-pointer">
            <div className="h-10 w-10 rounded-2xl bg-[#1c382b] flex items-center justify-center shadow-md shadow-[#1c382b]/15 group-hover:scale-105 group-hover:rotate-1 transition-all duration-300">
              <Activity className="h-5 w-5 text-[#cbdccf]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-[#1c382b] text-lg tracking-tight group-hover:text-[#37543e] transition-colors">Nexus Observe</span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#e6ede7] text-[#1c382b] border border-[#cbdccf] shadow-xs">
                  AIOps Tier 2
                </span>
              </div>
              <p className="text-xs text-[#756449] font-medium">Privacy-First Two-Tier Observability</p>
            </div>
          </div>

          {/* Right Status Controls */}
          <div className="flex items-center space-x-3">
            {/* Backend Connectivity Status Pill */}
            <div
              onClick={checkHealth}
              title={`FastAPI Server: ${backendStatus} • Click to recheck`}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer btn-tactile shadow-xs ${
                backendStatus === "online"
                  ? "bg-[#e6ede7] border-[#cbdccf] text-[#1c382b] hover:bg-[#d8e5da]"
                  : backendStatus === "checking"
                  ? "bg-[#f4f1ea] border-[#e5dec9] text-[#756449]"
                  : "bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100"
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  backendStatus === "online"
                    ? "bg-[#37543e] animate-live-beacon"
                    : backendStatus === "checking"
                    ? "bg-[#b5a281]"
                    : "bg-rose-500"
                }`}
              />
              <span>
                Backend: {backendStatus === "online" ? `Online (${latencyMs ?? 10}ms)` : backendStatus === "checking" ? "Checking..." : "Offline"}
              </span>
              <RefreshCw className="h-3 w-3 opacity-60 ml-0.5 hover:rotate-180 transition-transform duration-500" />
            </div>

            {/* Firestore Live Stream Pill */}
            <div className="hidden sm:flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-xl bg-[#f4f1ea] border border-[#e5dec9] text-[#544733] shadow-xs">
              <span className={`inline-block h-2 w-2 rounded-full ${listenerStatus === "live" ? "bg-[#37543e] animate-live-beacon" : "bg-[#b5a281]"}`} />
              <span className="font-medium">
                Firestore: {listenerStatus === "live" ? "Live Stream" : "Connecting"}
              </span>
            </div>

            {/* Tenant Claim Badge (No manual switch) */}
            {activeTenant && (
              <div className="flex items-center space-x-2 bg-[#f4f1ea] px-3 py-1.5 rounded-xl border border-[#e5dec9] shadow-xs">
                <Building className="h-3.5 w-3.5 text-[#1c382b]" />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-[#1c382b] leading-tight">
                    {activeTenant.name}
                  </span>
                  <span className="text-[10px] text-[#756449] font-mono leading-none">
                    {activeTenant.id}
                  </span>
                </div>
              </div>
            )}

            {/* User & Logout Button */}
            {user && (
              <div className="flex items-center space-x-2 pl-1">
                <div className="hidden lg:flex items-center space-x-1 text-xs text-[#544733] bg-[#f4f1ea] px-2.5 py-1.5 rounded-xl border border-[#e5dec9] shadow-xs">
                  <User className="h-3.5 w-3.5 text-[#968262]" />
                  <span className="font-medium">{user.email}</span>
                </div>
                <button
                  onClick={logout}
                  title="Sign out of Nexus Observe"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-[#e5dec9] bg-[#faf7f2] hover:bg-rose-50 hover:border-rose-200 hover:text-rose-800 text-[#544733] text-xs font-semibold btn-tactile shadow-xs cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1.5 overflow-x-auto py-2.5 scrollbar-none border-t border-[#eee8dc]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 whitespace-nowrap btn-tactile cursor-pointer ${
                  isActive
                    ? "bg-[#1c382b] text-[#faf7f2] shadow-sm shadow-[#1c382b]/20 scale-[1.02]"
                    : "text-[#544733] hover:text-[#1c382b] hover:bg-[#e6ede7]/70"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-[#a3c5b1]" : "text-[#968262]"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
