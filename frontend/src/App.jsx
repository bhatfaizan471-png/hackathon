import React, { useEffect, useState } from "react";
import { app, db } from "./firebase";

export default function App() {
  const [firebaseStatus, setFirebaseStatus] = useState("Connecting to Firebase...");

  useEffect(() => {
    if (app && app.name) {
      setFirebaseStatus(`Connected to Firebase project: ${app.options.projectId}`);
    } else {
      setFirebaseStatus("Firebase initialization failed.");
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl backdrop-blur">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Nexus Observe</h1>
        <p className="text-slate-400 text-sm mb-6">AIOps Two-Tier Observability Platform</p>
        
        <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/30 px-4 py-3 text-emerald-400 text-sm font-medium">
          {firebaseStatus}
        </div>
      </div>
    </div>
  );
}
