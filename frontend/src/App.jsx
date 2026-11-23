import React, { useState, useEffect } from "react";
import { TenantProvider, useTenant } from "./context/TenantContext";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import GetCollector from "./components/GetCollector";
import Overview from "./components/Overview";
import FleetTable from "./components/FleetTable";
import InfraView from "./components/InfraView";
import NetworkView from "./components/NetworkView";
import ApplicationView from "./components/ApplicationView";
import SecurityView from "./components/SecurityView";
import IncidentsView from "./components/IncidentsView";
import HealthHistoryView from "./components/HealthHistoryView";
import EgressPanel from "./components/EgressPanel";
import { AlertTriangle, LogOut, ShieldAlert, Loader2, CheckCircle2 } from "lucide-react";

function MainDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showCollectorPage, setShowCollectorPage] = useState(() => {
    return typeof window !== "undefined" && window.location.hash === "#collector";
  });
  const [createdToast, setCreatedToast] = useState(() => {
    if (typeof window !== "undefined" && window.sessionStorage) {
      const email = sessionStorage.getItem("nexus_just_created_account");
      if (email) {
        sessionStorage.removeItem("nexus_just_created_account");
        return email;
      }
    }
    return null;
  });
  const { user, authLoading, activeTenant, claimError, listenerError, logout } = useTenant();

  useEffect(() => {
    if (createdToast) {
      const timer = setTimeout(() => setCreatedToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [createdToast]);

  useEffect(() => {
    const onHashChange = () => {
      setShowCollectorPage(window.location.hash === "#collector");
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (showCollectorPage) {
    return (
      <GetCollector
        onBack={() => {
          if (typeof window !== "undefined") window.location.hash = "";
          setShowCollectorPage(false);
        }}
      />
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3 bg-[#faf7f2] p-8 rounded-3xl border border-[#e5dec9] shadow-sm">
          <Loader2 className="h-8 w-8 text-[#1c382b] animate-spin" />
          <span className="text-xs font-semibold text-[#544733] tracking-wide">
            Authenticating Nexus Observe...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Login
        onGetCollector={() => {
          if (typeof window !== "undefined") window.location.hash = "#collector";
          setShowCollectorPage(true);
        }}
      />
    );
  }

  if (claimError || !activeTenant?.id) {
    const errorMsg =
      claimError || (user?.email ? `Account '${user.email}' has no tenant assigned.` : "Account has no tenant assigned.");
    return (
      <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#faf7f2] rounded-3xl border border-[#e5dec9] p-8 shadow-sm space-y-4 text-center">
          <div className="h-12 w-12 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-800 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-[#24221f]">No Tenant Assignment</h2>
          <p className="text-xs text-[#544733] leading-relaxed">{errorMsg}</p>
          <div className="pt-4 border-t border-[#e5dec9] flex justify-center">
            <button
              onClick={logout}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold text-[#faf7f2] bg-[#1c382b] hover:bg-[#14291f] btn-tactile shadow-sm cursor-pointer"
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
    <div className="min-h-screen bg-[#f7f4ee] text-[#24221f] flex flex-col font-sans relative overflow-x-hidden">
      {/* Warm organic ambient sage & beige background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] bg-[#60896a]/8 rounded-full blur-3xl animate-soft-pulse" />
        <div className="absolute top-1/2 -left-32 w-[420px] h-[420px] bg-[#b5a281]/12 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-[360px] h-[360px] bg-[#37543e]/6 rounded-full blur-3xl" />
      </div>

      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Pop Up Notification on Account Creation */}
      {createdToast && (
        <div className="fixed top-20 right-6 z-50 bg-[#faf7f2] border-2 border-[#37543e] rounded-2xl p-4 shadow-2xl flex items-center space-x-3 animate-slide-down max-w-sm">
          <div className="h-10 w-10 rounded-xl bg-[#e6ede7] border border-[#cbdccf] flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5 text-[#37543e]" />
          </div>
          <div className="flex-1 text-xs">
            <div className="font-bold text-[#1c382b]">Account Created & Saved!</div>
            <div className="text-[#544733] mt-0.5">Account '{createdToast}' stored in database. Welcome!</div>
          </div>
          <button
            onClick={() => setCreatedToast(null)}
            className="text-[#968262] hover:text-[#24221f] text-xs font-bold px-1.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Visible Listener Error Banner */}
      {listenerError && (
        <div className="bg-rose-50/90 border-b border-rose-200 px-4 py-3 animate-slide-down relative z-10">
          <div className="max-w-7xl mx-auto flex items-center space-x-2.5 text-xs text-rose-800 font-medium">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="font-bold">Firestore Error:</span>
            <span className="flex-1">{listenerError}</span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div key={activeTab} className="animate-fade-in">
          {activeTab === "overview" && <Overview onNavigate={setActiveTab} />}
          {activeTab === "fleet" && <FleetTable />}
          {activeTab === "infra" && <InfraView />}
          {activeTab === "network" && <NetworkView />}
          {activeTab === "app" && <ApplicationView />}
          {activeTab === "security" && <SecurityView />}
          {activeTab === "incidents" && <IncidentsView />}
          {activeTab === "history" && <HealthHistoryView />}
          {activeTab === "egress" && <EgressPanel />}
          {activeTab === "collector" && <GetCollector onBack={() => setActiveTab("overview")} />}
        </div>
      </main>

      <footer className="border-t border-[#e5dec9] bg-[#faf7f2]/90 backdrop-blur-md py-5 text-center text-xs text-[#756449] relative z-10 font-medium">
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
