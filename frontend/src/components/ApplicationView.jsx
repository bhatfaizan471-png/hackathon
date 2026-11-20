import React from "react";
import { useTenant } from "../context/TenantContext";
import { CheckCircle2 } from "lucide-react";

export default function ApplicationView() {
  const { collectors, activeTenant } = useTenant();

  const appHosts = collectors.filter((c) => c.source_role === "web_server" || c.customer_facing);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0c4a3e] tracking-tight">Application & Web Services</h2>
        <p className="text-xs text-stone-500">Customer-facing endpoints and service health status for {activeTenant.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {appHosts.length > 0 ? (
          appHosts.map((host) => (
            <div key={host.id} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-800 text-sm">
                  Service: {host.customer_facing || "core_web"}
                </span>
                <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[#e7f3ec] text-[#0c4a3e]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-xs font-bold">UP</span>
                </div>
              </div>
              <div className="text-xs text-stone-500 font-mono">
                Host ID: {host.source_id}
              </div>
              <div className="text-xs text-stone-500">
                Uptime Heartbeat: {host.last_seen_utc ? "Active" : "None"}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-3 text-xs text-stone-500 italic py-8 text-center rounded-2xl border border-stone-200 bg-white">
            No customer-facing services currently reporting in this tenant.
          </div>
        )}
      </div>
    </div>
  );
}
