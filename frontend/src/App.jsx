import React, { useState } from "react";
import { TenantProvider } from "./context/TenantContext";
import Navbar from "./components/Navbar";
import Overview from "./components/Overview";
import FleetTable from "./components/FleetTable";
import InfraView from "./components/InfraView";
import NetworkView from "./components/NetworkView";
import ApplicationView from "./components/ApplicationView";
import SecurityView from "./components/SecurityView";
import IncidentsView from "./components/IncidentsView";
import HealthHistoryView from "./components/HealthHistoryView";
import EgressPanel from "./components/EgressPanel";

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <TenantProvider>
      <div className="min-h-screen bg-[#f8faf8] text-stone-800 flex flex-col font-sans">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
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
    </TenantProvider>
  );
}
