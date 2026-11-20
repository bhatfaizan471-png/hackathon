import React, { useState } from "react";
import { TenantProvider, useTenant } from "./context/TenantContext";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import Overview from "./components/Overview";
import FleetTable from "./components/FleetTable";
import InfraView from "./components/InfraView";
import NetworkView from "./components/NetworkView";
import ApplicationView from "./components/ApplicationView";
import SecurityView from "./components/SecurityView";
import IncidentsView from "./components/IncidentsView";
import HealthHistoryView from "./components/HealthHistoryView";
import EgressPanel from "./components/EgressPanel";
import { AlertTriangle, LogOut, ShieldAlert, Loader2 } from "lucide-react";

function MainDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const { user, authLoading, activeTenant, claimError, listenerError, logout } = useTenant();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f8faf8] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="h-8 w-8 text-[#0c4a3e] animate-spin" />
          <span className="text-xs font-semibold text-stone-600 tracking-wide">
            Authenticating Nexus Observe...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (claimError || !activeTenant?.id) {
    const errorMsg =
      claimError || (user?.email ? `Account '${user.email}' has no tenant assigned.` : "Account has no tenant assigned.");
    return (
      <div className="min-h-screen bg-[#f8faf8] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-stone-200 p-8 shadow-sm space-y-4 text-center">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-stone-800">No Tenant Assignment</h2>
          <p className="text-xs text-stone-600 leading-relaxed">{errorMsg}</p>
          <div className="pt-4 border-t border-stone-100 flex justify-center">
            <button
              onClick={logout}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0c4a3e] hover:bg-[#093930] transition shadow-sm"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out & Try Again</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faf8] text-stone-800 flex flex-col font-sans">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Visible Listener Error Banner */}
      {listenerError && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center space-x-2.5 text-xs text-rose-800 font-medium">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="font-bold">Firestore Error:</span>
            <span className="flex-1">{listenerError}</span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "overview" && <Overview onNavigate={setActiveTab} />}
        {activeTab === "fleet" && <FleetTable />}
        {activeTab === "infra" && <InfraView />}
        {activeTab === "network" && <NetworkView />}
        {activeTab === "app" && <ApplicationView />}
        {activeTab === "security" && <SecurityView />}
        {activeTab === "incidents" && <IncidentsView />}
        {activeTab === "history" && <HealthHistoryView />}
        {activeTab === "egress" && <EgressPanel />}
      </main>

      <footer className="border-t border-stone-200 bg-white/90 py-5 text-center text-xs text-stone-500">
        Nexus Observe &copy; 2026 &bull; Privacy-Preserving AIOps Infrastructure Observability
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <TenantProvider>
      <MainDashboard />
    </TenantProvider>
  );
}
