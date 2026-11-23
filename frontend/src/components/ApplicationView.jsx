import React from "react";
import { useTenant } from "../context/TenantContext";
import { CheckCircle2 } from "lucide-react";

export default function ApplicationView() {
  const { collectors, activeTenant } = useTenant();

  const appHosts = collectors.filter((c) => c.source_role === "web_server" || c.customer_facing);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#1c382b] tracking-tight">Application & Web Services</h2>
        <p className="text-xs text-[#756449]">Customer-facing endpoints and service health status for {activeTenant.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {appHosts.length > 0 ? (
          appHosts.map((host) => (
            <div key={host.id} className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-6 shadow-xs space-y-3 card-hover border-t-4 border-t-[#37543e]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#24221f] text-sm">
                  Service: {host.customer_facing || "core_web"}
                </span>
                <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#e6ede7] text-[#1c382b] border border-[#cbdccf] shadow-2xs">
                  <span className="h-2 w-2 rounded-full bg-[#37543e] animate-live-beacon" />
                  <span className="text-xs font-bold">UP</span>
                </div>
              </div>
              <div className="text-xs text-[#756449] font-mono">
                Host ID: {host.source_id}
              </div>
              <div className="text-xs text-[#544733]">
                Uptime Heartbeat: {host.last_seen_utc ? "Active" : "None"}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-3 text-xs text-[#756449] italic py-8 text-center rounded-3xl border border-[#e5dec9] bg-[#faf7f2]">
            No customer-facing services currently reporting in this tenant.
          </div>
        )}
      </div>
    </div>
  );
}
