import React, { createContext, useContext, useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { onAuthStateChanged, getIdTokenResult, signOut } from "firebase/auth";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTenant, setActiveTenant] = useState(null);
  const [claimError, setClaimError] = useState(null);
  const [listenerError, setListenerError] = useState(null);

  const [collectors, setCollectors] = useState([]);
  const [telemetry, setTelemetry] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [healthHistory, setHealthHistory] = useState([]);
  const [listenerStatus, setListenerStatus] = useState("disconnected");
  const [lastDataTimestamp, setLastDataTimestamp] = useState(null);

  // Helper to clear all tenant-scoped telemetry and listener state
  const clearTenantData = () => {
    setCollectors([]);
    setTelemetry([]);
    setAlerts([]);
    setIncidents([]);
    setHealthHistory([]);
    setListenerStatus("disconnected");
    setLastDataTimestamp(null);
    setListenerError(null);
  };

  // 1. Authentication and Custom Claims Watcher
  // Keeps loading state active until onAuthStateChanged fires AND getIdTokenResult returns tenant_id claim
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setAuthLoading(true);
      setListenerError(null);

      if (!currentUser) {
        setUser(null);
        setActiveTenant(null);
        setClaimError(null);
        clearTenantData();
        setAuthLoading(false);
        return;
      }

      // User changed or logged in: immediately clear previous tenant data
      clearTenantData();

      try {
        // Force token refresh so latest custom claims are retrieved
        const tokenResult = await getIdTokenResult(currentUser, true);
        const tenantId = tokenResult.claims?.tenant_id;

        if (!tenantId) {
          setUser(currentUser);
          setActiveTenant(null);
          setClaimError(
            `Account '${currentUser.email}' has no tenant assigned.`
          );
        } else {
          setClaimError(null);
          const tenantName =
            tenantId === "tenant_acme_demo"
              ? "Company A (Acme Demo)"
              : tenantId === "tenant_beta_corp"
              ? "Company B (Beta Corp)"
              : tenantId;

          setUser(currentUser);
          setActiveTenant({
            id: tenantId,
            name: tenantName,
            role: "Tenant Admin",
          });
        }
      } catch (err) {
        console.error("Error retrieving ID token result:", err);
        setUser(currentUser);
        setActiveTenant(null);
        setClaimError(`Token error: ${err.message || err.code}`);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubAuth();
  }, []);

  // 2. Start Firestore Listeners ONLY after tenantId is known
  // Detaches on logout or when user changes; on permission-denied refreshes token once and re-attaches
  useEffect(() => {
    if (!user || !activeTenant?.id) {
      clearTenantData();
      return;
    }

    const tenantId = activeTenant.id;
    setListenerStatus("connecting");
    setListenerError(null);

    let isSubscribed = true;
    let unsubs = [];
    let retryAttempted = false;

    const handleListenerError = async (err, listenerName) => {
      console.error(`Error in ${listenerName}:`, err);
      const isPermissionDenied =
        err.code === "permission-denied" ||
        (err.message && err.message.toLowerCase().includes("permission"));

      if (isPermissionDenied && !retryAttempted && auth.currentUser) {
        retryAttempted = true;
        console.warn(`Permission denied on ${listenerName}. Refreshing ID token and re-attaching listeners once...`);
        try {
          await auth.currentUser.getIdToken(true);
          if (!isSubscribed) return;
          // Unsubscribe existing listeners before re-attaching
          unsubs.forEach((unsub) => {
            try {
              unsub();
            } catch (_) {}
          });
          unsubs = [];
          // Re-attach once
          attachListeners();
          return;
        } catch (refreshErr) {
          console.error("Token refresh failed after permission-denied:", refreshErr);
        }
      }

      if (isSubscribed) {
        setListenerError(`Firestore error (${listenerName}): ${err.message || err.code}`);
        setListenerStatus("error");
      }
    };

    const attachListeners = () => {
      if (!isSubscribed) return;
      try {
        // 1. Live Collectors listener
        const colRef = collection(db, "tenants", tenantId, "collectors");
        const unsubCollectors = onSnapshot(
          colRef,
          (snap) => {
            if (!isSubscribed) return;
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setCollectors(list);
            setListenerStatus("live");
            setLastDataTimestamp(new Date().toLocaleTimeString());
          },
          (err) => handleListenerError(err, "Collectors")
        );
        unsubs.push(unsubCollectors);

        // 2. Live Telemetry listener (limited to last 60 points)
        const telRef = collection(db, "tenants", tenantId, "telemetry");
        const telQuery = query(telRef, orderBy("event_time_utc", "desc"), limit(60));
        const unsubTelemetry = onSnapshot(
          telQuery,
          (snap) => {
            if (!isSubscribed) return;
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
            setTelemetry(list);
            setLastDataTimestamp(new Date().toLocaleTimeString());
          },
          (err) => handleListenerError(err, "Telemetry")
        );
        unsubs.push(unsubTelemetry);

        // 3. Live Alerts listener (limited to 20)
        const altRef = collection(db, "tenants", tenantId, "alerts");
        const altQuery = query(altRef, orderBy("created_time_utc", "desc"), limit(20));
        const unsubAlerts = onSnapshot(
          altQuery,
          (snap) => {
            if (!isSubscribed) return;
            setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          },
          (err) => handleListenerError(err, "Alerts")
        );
        unsubs.push(unsubAlerts);

        // 4. Live Incidents listener (TASK C: ordered by updated_utc, limit 20)
        const incRef = collection(db, "tenants", tenantId, "incidents");
        const incQuery = query(incRef, orderBy("updated_utc", "desc"), limit(20));
        const unsubIncidents = onSnapshot(
          incQuery,
          (snap) => {
            if (!isSubscribed) return;
            setIncidents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          },
          (err) => handleListenerError(err, "Incidents")
        );
        unsubs.push(unsubIncidents);

        // 5. Live Health History listener (limited to 20)
        const histRef = collection(db, "tenants", tenantId, "health_history");
        const histQuery = query(histRef, orderBy("time_utc", "desc"), limit(20));
        const unsubHist = onSnapshot(
          histQuery,
          (snap) => {
            if (!isSubscribed) return;
            setHealthHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          },
          (err) => handleListenerError(err, "Health History")
        );
        unsubs.push(unsubHist);
      } catch (e) {
        console.error("Firestore initialization error:", e);
        setListenerError(`Firestore error: ${e.message}`);
        setListenerStatus("error");
      }
    };

    attachListeners();

    return () => {
      isSubscribed = false;
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch (_) {}
      });
    };
  }, [user?.uid, activeTenant?.id]);

  const logout = async () => {
    clearTenantData();
    setUser(null);
    setActiveTenant(null);
    setClaimError(null);
    await signOut(auth);
  };

  return (
    <TenantContext.Provider
      value={{
        user,
        authLoading,
        activeTenant,
        claimError,
        listenerError,
        logout,
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
