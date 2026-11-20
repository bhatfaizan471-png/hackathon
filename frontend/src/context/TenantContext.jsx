import React, { createContext, useContext, useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";

const TenantContext = createContext(null);

export const TENANTS = [
  { id: "tenant_acme_demo", name: "Company A (Acme Demo)", role: "Tenant Admin" },
  { id: "tenant_beta_corp", name: "Company B (Beta Corp)", role: "Tenant Admin" },
];

export function TenantProvider({ children }) {
  const [activeTenant, setActiveTenant] = useState(TENANTS[0]);
  const [collectors, setCollectors] = useState([]);
  const [telemetry, setTelemetry] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [healthHistory, setHealthHistory] = useState([]);
  const [listenerStatus, setListenerStatus] = useState("initializing");
  const [lastDataTimestamp, setLastDataTimestamp] = useState(null);

  useEffect(() => {
    setCollectors([]);
    setTelemetry([]);
    setAlerts([]);
    setIncidents([]);
    setHealthHistory([]);
    setListenerStatus("connecting");

    const tenantId = activeTenant.id;

    try {
      // 1. Live Collectors listener
      const colRef = collection(db, "tenants", tenantId, "collectors");
      const unsubCollectors = onSnapshot(
        colRef,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setCollectors(list);
          setListenerStatus("live");
          setLastDataTimestamp(new Date().toLocaleTimeString());
        },
        (err) => {
          console.warn("Collector listener error (using local mock if offline):", err);
          setListenerStatus("offline-ready");
        }
      );

      // 2. Live Telemetry listener (limited to last 60 points)
      const telRef = collection(db, "tenants", tenantId, "telemetry");
      const telQuery = query(telRef, orderBy("event_time_utc", "desc"), limit(60));
      const unsubTelemetry = onSnapshot(
        telQuery,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
          setTelemetry(list);
          setLastDataTimestamp(new Date().toLocaleTimeString());
        },
        (err) => console.warn("Telemetry listener note:", err)
      );

      // 3. Live Alerts listener
      const altRef = collection(db, "tenants", tenantId, "alerts");
      const altQuery = query(altRef, orderBy("created_time_utc", "desc"), limit(20));
      const unsubAlerts = onSnapshot(
        altQuery,
        (snap) => setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.warn("Alerts listener note:", err)
      );

      // 4. Live Health History listener
      const histRef = collection(db, "tenants", tenantId, "health_history");
      const histQuery = query(histRef, orderBy("time_utc", "desc"), limit(20));
      const unsubHist = onSnapshot(
        histQuery,
        (snap) => setHealthHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.warn("History listener note:", err)
      );

      return () => {
        unsubCollectors();
        unsubTelemetry();
        unsubAlerts();
        unsubHist();
      };
    } catch (e) {
      console.warn("Firestore listeners error:", e);
      setListenerStatus("error");
    }
  }, [activeTenant.id]);

  return (
    <TenantContext.Provider
      value={{
        activeTenant,
        setActiveTenant,
        collectors,
        telemetry,
        alerts,
        incidents,
        healthHistory,
        listenerStatus,
        lastDataTimestamp,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
