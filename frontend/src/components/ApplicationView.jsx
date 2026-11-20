import React from "react";
import { useTenant } from "../context/TenantContext";
import { CheckCircle2, XCircle } from "lucide-react";

export default function ApplicationView() {
  const { collectors, telemetry, activeTenant } = useTenant();

  const appHosts = collectors.filter((c) => c.source_role === "web_server" || c.customer_facing);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Application & Web Services</h2>
        <p className="text-xs text-slate-400">Customer-facing endpoints and service health status for {activeTenant.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {appHosts.length > 0 ? (
          appHosts.map((host) => (
            <div key={host.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 text-sm">
                  Service: {host.customer_facing || "core_web"}
                </span>
                <div className="flex items-center space-x-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">UP</span>
                </div>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Host ID: {host.source_id}
              </div>
              <div className="text-xs text-slate-400">
                Uptime Heartbeat: {host.last_seen_utc ? "Active" : "None"}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-3 text-xs text-slate-500 italic py-8 text-center rounded-xl border border-slate-800 bg-slate-900/30">
            No customer-facing services currently reporting in this tenant.
          </div>
        )}
      </div>
    </div>
  );
}
