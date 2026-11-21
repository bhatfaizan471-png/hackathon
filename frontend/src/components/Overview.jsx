import React, { useState } from "react";
import { useTenant } from "../context/TenantContext";
import { useBackendHealth } from "../utils/backendHealth";
import { calculateStaleness } from "../utils/staleness";
import { computeSha256 } from "../utils/crypto";
import { getIngestUrls } from "../utils/ingestUrl";
import { Server, Activity, ShieldCheck, AlertTriangle, ArrowUpRight, CheckCircle2, XCircle, RefreshCw, Send, Check } from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

export default function Overview({ onNavigate }) {
  const { activeTenant, collectors, telemetry, alerts, incidents } = useTenant();
  const { status: backendStatus, details: backendDetails, latencyMs, checkHealth } = useBackendHealth();

  const [isSending, setIsSending] = useState(false);
  const [lastSentId, setLastSentId] = useState(null);
  const [sendError, setSendError] = useState(null);

  const totalHosts = collectors.length;
  let onlineCount = 0;
  let poorCount = 0;
  let fairCount = 0;
  let goodCount = 0;

  collectors.forEach((col) => {
    const st = calculateStaleness(col.last_seen_utc, col.health_state || "good");
    if (col.status === "online" && !st.isStale) onlineCount++;
    if (st.effectiveState === "poor") poorCount++;
    else if (st.effectiveState === "fair") fairCount++;
    else goodCount++;
  });

  const latestPoint = telemetry[telemetry.length - 1];
  const overallState = poorCount > 0 ? "Poor" : fairCount > 0 ? "Fair" : "Good";

  const stateColors = {
    Good: "text-[#0c4a3e] border-[#cbe6d5] bg-[#e7f3ec]",
    Fair: "text-amber-800 border-amber-200 bg-amber-50",
    Poor: "text-rose-800 border-rose-200 bg-rose-50",
  };

  const handleSendSampleTelemetry = async () => {
    setIsSending(true);
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const randomCpu = Math.round(30 + Math.random() * 45);
      const randomMem = Math.round(45 + Math.random() * 25);
      const randomLatency = Math.round(15 + Math.random() * 35);
      const payloadId = "sample-" + Math.random().toString(36).substring(2, 10) + "-" + Date.now();

      const samplePayload = {
        schema_version: "1.0",
        payload_id: payloadId,
        tenant_id: activeTenant.id,
        collector_id: "col_sim_laptop_01",
        collector_version: "0.1.0",
        source_id: "src_1a2b3c4d5e",
        source_role: "employee_laptop",
        customer_facing: "login",
        seq: Date.now(),
        event_time_utc: nowIso,
        sent_time_utc: nowIso,
        source_timezone: "Asia/Kolkata",
        config_version: "cfg-1",
        heartbeat: { uptime_s: 3600, buffer_depth: 0, simulated: true },
        metrics: {
          cpu_percent: randomCpu,
          memory_percent: randomMem,
          disk_percent: 44.0,
          net_latency_ms: randomLatency,
          packet_loss_percent: 0.0,
          bandwidth_in_kbps: 180.0,
          bandwidth_out_kbps: 75.0,
          service_up: true,
        },
        security: {
          auth_failure_count: 0,
          window_s: 60,
          risk_level: "none",
          secrets_redacted_count: 0,
        },
        local_health: {
          state: "excellent",
          reasons: ["Manual sample telemetry test"],
        },
        alerts: [],
      };

      const jsonStr = JSON.stringify(samplePayload);
      const sha256 = await computeSha256(jsonStr);

      const headers = {
        "Authorization": "Bearer demo-key-laptop-01",
        "X-Collector-Id": "col_sim_laptop_01",
        "X-Payload-SHA256": sha256,
        "Content-Type": "application/json",
      };

      const candidateUrls = getIngestUrls({
        isProd: import.meta.env.PROD,
        backendUrl: BACKEND_URL,
      });

      let res = null;
      let lastErr = null;

      for (const url of candidateUrls) {
        try {
          res = await fetch(url, {
            method: "POST",
            headers,
            body: jsonStr,
          });

          // Move to next URL if 404 (e.g. dev proxy absent in production)
          if (res.status === 404) {
            lastErr = new Error(`Endpoint not found (404) at ${url}`);
            continue;
          }

          // Do not retry on 401, 403, 422 or any non-404 status: break immediately
          break;
        } catch (e) {
          lastErr = e;
          res = null;
        }
      }

      if (res && res.ok) {
        setLastSentId(payloadId);
        setSendError(null);
        setTimeout(() => setLastSentId(null), 6000);
      } else if (res) {
        let detail = "";
        try {
          const errData = await res.json();
          detail = errData.detail
            ? typeof errData.detail === "string"
              ? errData.detail
              : JSON.stringify(errData.detail)
            : "";
        } catch {
          // ignore JSON parse failure
        }
        const errMsg = `HTTP ${res.status}${detail ? `: ${detail}` : ""}`;
        setSendError(errMsg);
        setTimeout(() => setSendError(null), 8000);
      } else {
        const errMsg = lastErr?.message || "Failed to connect to ingest endpoint";
        setSendError(errMsg);
        setTimeout(() => setSendError(null), 8000);
      }
    } catch (e) {
      console.warn("Could not send sample telemetry:", e);
      setSendError(e?.message || "Unexpected error");
      setTimeout(() => setSendError(null), 8000);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform Banner */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0c4a3e] tracking-tight">
              {activeTenant.name} Telemetry Hub
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              Zero-Trust Metadata Egress: raw log lines, user credentials, and customer data never leave customer boundaries.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider ${stateColors[overallState]}`}>
              Fleet Health: {overallState}
            </div>
            <button
              onClick={() => onNavigate("egress")}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#0c4a3e] hover:bg-[#093a30] text-white text-xs font-semibold shadow-sm transition"
            >
              <span>Verify Egress Proof</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Backend & Connectivity Diagnostic Card */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Tier 2 SaaS Backend Status:</span>
            {backendStatus === "online" ? (
              <span className="flex items-center space-x-1 text-xs font-bold text-[#0c4a3e] bg-[#e7f3ec] px-2.5 py-0.5 rounded-full border border-[#cbe6d5]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>ONLINE & CONNECTED</span>
              </span>
            ) : backendStatus === "checking" ? (
              <span className="text-xs font-bold text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-full">
                Checking...
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                <XCircle className="h-3.5 w-3.5" />
                <span>OFFLINE / DISCONNECTED</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSendSampleTelemetry}
              disabled={isSending}
              title="Send simulated demo payload"
              className={`flex items-center space-x-1.5 text-xs font-bold text-white px-3.5 py-1.5 rounded-xl transition shadow-sm ${
                sendError ? "bg-rose-700 hover:bg-rose-800" : "bg-[#0c4a3e] hover:bg-[#093a30]"
              }`}
            >
              {sendError ? (
                <XCircle className="h-3.5 w-3.5 text-rose-200" />
              ) : lastSentId ? (
                <Check className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              <span>
                {isSending
                  ? "Ingesting..."
                  : sendError
                  ? `Failed: ${sendError}`
                  : lastSentId
                  ? "Simulated demo payload sent!"
                  : "Send Test Telemetry"}
              </span>
            </button>

            <button
              onClick={checkHealth}
              className="flex items-center space-x-1 text-xs font-semibold text-[#0c4a3e] hover:bg-[#e7f3ec] px-2.5 py-1.5 rounded-xl border border-[#cbe6d5] transition"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Ping</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3 text-xs">
          <div className="bg-[#f8faf8] p-3 rounded-xl border border-stone-200">
            <span className="text-stone-500 font-medium">Stored Data Points:</span>
            <div className="font-mono text-[#0c4a3e] font-extrabold text-sm mt-0.5">
              {telemetry.length} document(s)
            </div>
          </div>
          <div className="bg-[#f8faf8] p-3 rounded-xl border border-stone-200">
            <span className="text-stone-500 font-medium">Ingest API Endpoint:</span>
            <div className="font-mono text-stone-800 font-semibold mt-0.5">POST /v1/ingest</div>
          </div>
          <div className="bg-[#f8faf8] p-3 rounded-xl border border-stone-200">
            <span className="text-stone-500 font-medium">Server Latency:</span>
            <div className="font-mono text-stone-800 font-semibold mt-0.5">
              {latencyMs != null ? `${latencyMs} ms` : "—"}
            </div>
          </div>
          <div className="bg-[#f8faf8] p-3 rounded-xl border border-stone-200">
            <span className="text-stone-500 font-medium">Service Version:</span>
            <div className="font-mono text-[#0c4a3e] font-semibold mt-0.5">
              {backendDetails?.version ? `v${backendDetails.version}` : "FastAPI 0.115+"}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Total Hosts</span>
            <div className="p-2 rounded-lg bg-[#e7f3ec]">
              <Server className="h-4 w-4 text-[#0c4a3e]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#0c4a3e]">{totalHosts}</span>
            <span className="text-xs font-semibold text-emerald-700">({onlineCount} online)</span>
          </div>
          <div className="mt-2 text-xs text-stone-500">Autonomous metadata collectors</div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Active Alerts</span>
            <div className="p-2 rounded-lg bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-stone-800">{alerts.length}</span>
            <span className="text-xs font-medium text-stone-500">in cooldown</span>
          </div>
          <div className="mt-2 text-xs text-stone-500">Threshold & EWMA anomaly triggers</div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">AIOps Incidents</span>
            <div className="p-2 rounded-lg bg-rose-50">
              <Activity className="h-4 w-4 text-rose-700" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-stone-800">{incidents.length}</span>
            <span className="text-xs font-semibold text-rose-600">correlated</span>
          </div>
          <div className="mt-2 text-xs text-stone-500">Multi-signal 2-minute clustering</div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Privacy Engine</span>
            <div className="p-2 rounded-lg bg-[#e7f3ec]">
              <ShieldCheck className="h-4 w-4 text-[#0c4a3e]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#0c4a3e]">100%</span>
            <span className="text-xs font-medium text-stone-500">Allow-list</span>
          </div>
          <div className="mt-2 text-xs text-stone-500">0 secrets leaked outside boundary</div>
        </div>
      </div>

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-[#0c4a3e] mb-4">Live Telemetry Snapshot</h3>
          {latestPoint ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs py-2 border-b border-stone-100">
                <span className="text-stone-500 font-medium">Last Received</span>
                <span className="text-stone-800 font-mono font-semibold">{latestPoint.event_time_utc}</span>
              </div>
              <div className="flex justify-between items-center text-xs py-2 border-b border-stone-100">
                <span className="text-stone-500 font-medium">Active Source</span>
                <span className="text-[#0c4a3e] font-mono font-semibold">{latestPoint.source_id} ({latestPoint.source_role})</span>
              </div>
              <div className="flex justify-between items-center text-xs py-2 border-b border-stone-100">
                <span className="text-stone-500 font-medium">CPU / RAM / Disk</span>
                <span className="text-stone-800 font-mono font-semibold">
                  {latestPoint.metrics?.cpu_percent}% / {latestPoint.metrics?.memory_percent}% / {latestPoint.metrics?.disk_percent}%
                </span>
              </div>
              <div className="flex justify-between items-center text-xs py-2 border-b border-stone-100">
                <span className="text-stone-500 font-medium">Latency / Packet Loss</span>
                <span className="text-stone-800 font-mono font-semibold">
                  {latestPoint.metrics?.net_latency_ms} ms / {latestPoint.metrics?.packet_loss_percent}%
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-stone-500 italic py-8 text-center bg-stone-50 rounded-xl">
              Awaiting telemetry from active collectors... Run collector with <code>python -m collector.collector --simulate</code> or click <strong>Send Test Telemetry</strong> above.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-[#0c4a3e] mb-4">Security & Compliance Guard</h3>
          <div className="space-y-4 text-xs">
            <div className="flex items-center space-x-2.5 text-[#0c4a3e] bg-[#e7f3ec] border border-[#cbe6d5] p-3.5 rounded-xl font-medium">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <span>Allow-list strictly enforces zero sensitive data egress across all hosts.</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-stone-700">
              <span className="text-stone-500 font-medium">Redacted Secrets Count</span>
              <span className="font-mono font-bold text-[#0c4a3e]">{latestPoint?.security?.secrets_redacted_count ?? 0} locally scrubbed</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-stone-700">
              <span className="text-stone-500 font-medium">Failed Logins Tracked</span>
              <span className="font-mono font-bold text-stone-800">{latestPoint?.security?.auth_failure_count ?? 0} (count only, no usernames/IPs)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
