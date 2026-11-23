import React, { useState } from "react";
import { useTenant } from "../context/TenantContext";
import { useBackendHealth } from "../utils/backendHealth";
import { calculateStaleness } from "../utils/staleness";
import { computeSha256 } from "../utils/crypto";
import { getIngestUrls } from "../utils/ingestUrl";
import {
  Server,
  Activity,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  Check,
  Search,
  Copy,
  Code2,
  Eye,
} from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

export default function Overview({ onNavigate }) {
  const { activeTenant, collectors, telemetry, alerts, incidents } = useTenant();
  const { status: backendStatus, details: backendDetails, latencyMs, checkHealth } = useBackendHealth();

  const [isSending, setIsSending] = useState(false);
  const [lastSentId, setLastSentId] = useState(null);
  const [sendError, setSendError] = useState(null);

  // Interactive vibe-coded controls
  const [hostSearch, setHostSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [snapshotView, setSnapshotView] = useState("metrics"); // 'metrics' | 'json'
  const [copiedJson, setCopiedJson] = useState(false);

  const totalHosts = collectors.length;
  let onlineCount = 0;
  let poorCount = 0;
  let fairCount = 0;
  let goodCount = 0;

  collectors.forEach((col) => {
    const st = calculateStaleness(col.last_seen_utc, col.health_state || "good", col.observed_interval_s ?? 5);
    if (col.status === "online" && !st.isStale) onlineCount++;
    if (st.effectiveState === "poor") poorCount++;
    else if (st.effectiveState === "fair") fairCount++;
    else goodCount++;
  });

  const latestPoint = telemetry[telemetry.length - 1];
  const overallState = poorCount > 0 ? "Poor" : fairCount > 0 ? "Fair" : "Good";

  const stateColors = {
    Good: "text-[#1c382b] border-[#cbdccf] bg-[#e6ede7]",
    Fair: "text-[#8f6b28] border-[#eedbb2] bg-[#faf3e0]",
    Poor: "text-[#8f2828] border-[#f0c2c2] bg-[#fae8e8]",
  };

  // Filter collectors based on interactive search & status tab
  const filteredCollectors = collectors.filter((col) => {
    const st = calculateStaleness(col.last_seen_utc, col.health_state || "good", col.observed_interval_s ?? 5);
    const matchesSearch =
      !hostSearch ||
      col.id?.toLowerCase().includes(hostSearch.toLowerCase()) ||
      col.source_id?.toLowerCase().includes(hostSearch.toLowerCase()) ||
      col.source_role?.toLowerCase().includes(hostSearch.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "online") return col.status === "online" && !st.isStale;
    if (statusFilter === "poor") return st.effectiveState === "poor";
    if (statusFilter === "fair") return st.effectiveState === "fair";
    return true;
  });

  const handleCopyJson = () => {
    if (!latestPoint) return;
    navigator.clipboard.writeText(JSON.stringify(latestPoint, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
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

          // Do not retry on client auth or validation errors
          if (res.status === 401 || res.status === 403 || res.status === 422) {
            const errData = await res.json().catch(() => ({}));
            const detail = errData.detail || `Server returned HTTP ${res.status}`;
            throw new Error(`Ingest rejected (${res.status}): ${detail}`);
          }

          if (res.ok) {
            lastErr = null;
            break;
          } else {
            lastErr = new Error(`Ingest failed with status ${res.status}`);
          }
        } catch (fetchErr) {
          if (fetchErr.message && fetchErr.message.startsWith("Ingest rejected")) {
            throw fetchErr;
          }
          lastErr = fetchErr;
        }
      }

      if (res && res.ok) {
        setLastSentId(payloadId);
        setSendError(null);
        setTimeout(() => setLastSentId(null), 6000);
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
      {/* Platform Banner (Beige / Green Warm Aesthetic) */}
      <div className="relative overflow-hidden rounded-3xl border border-[#e5dec9] bg-gradient-to-r from-[#faf7f2] via-[#f7f3ea] to-[#edf4ee] p-6 shadow-sm card-hover">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1c382b] via-[#60896a] to-[#b5a281]" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#756449] bg-[#ece5d8] px-2.5 py-0.5 rounded-full border border-[#ded2be]">
                Egress Boundary Tier 2
              </span>
              <span className="text-[11px] text-[#544733] font-mono font-medium">
                Tenant: {activeTenant.id}
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-[#1c382b] tracking-tight">
              {activeTenant.name} Telemetry Hub
            </h2>
            <p className="text-xs text-[#544733] mt-1 max-w-2xl leading-relaxed">
              Zero-Trust Metadata Egress: local hardware logs, sensitive credentials, and customer data never cross boundary perimeters.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-2xl border text-xs font-bold uppercase tracking-wider shadow-2xs ${stateColors[overallState]}`}>
              <span className={`h-2 w-2 rounded-full ${overallState === "Good" || overallState === "Excellent" ? "bg-[#37543e] animate-live-beacon" : overallState === "Fair" ? "bg-[#b59351] animate-live-beacon-amber" : "bg-rose-600 animate-live-beacon-rose"}`} />
              <span>Fleet Health: {overallState}</span>
            </div>
            <button
              onClick={() => onNavigate("egress")}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-2xl bg-[#1c382b] hover:bg-[#14291f] text-[#faf7f2] text-xs font-semibold btn-tactile shadow-xs cursor-pointer"
            >
              <span>Verify Egress Proof</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#a3c5b1]" />
            </button>
          </div>
        </div>
      </div>

      {/* Backend & Connectivity Diagnostic Card */}
      <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2]/95 backdrop-blur-sm p-5 shadow-xs card-hover">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#eee8dc] pb-3.5">
          <div className="flex items-center space-x-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#756449]">Backend SaaS Link:</span>
            {backendStatus === "online" ? (
              <span className="flex items-center space-x-1.5 text-xs font-bold text-[#1c382b] bg-[#e6ede7] px-3 py-1 rounded-full border border-[#cbdccf] shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-[#37543e] animate-live-beacon" />
                <span>ONLINE & CONNECTED</span>
              </span>
            ) : backendStatus === "checking" ? (
              <span className="text-xs font-bold text-[#756449] bg-[#f4f1ea] px-3 py-1 rounded-full border border-[#e5dec9]">
                Checking link...
              </span>
            ) : (
              <span className="flex items-center space-x-1.5 text-xs font-bold text-rose-800 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span>OFFLINE / DISCONNECTED</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSendSampleTelemetry}
              disabled={isSending}
              title="Send simulated demo payload"
              className={`flex items-center space-x-1.5 text-xs font-bold text-[#faf7f2] px-3.5 py-1.5 rounded-2xl btn-tactile shadow-xs cursor-pointer ${
                sendError
                  ? "bg-rose-800 hover:bg-rose-900"
                  : lastSentId
                  ? "bg-[#2f5a3e]"
                  : "bg-[#1c382b] hover:bg-[#14291f]"
              }`}
            >
              {sendError ? (
                <XCircle className="h-3.5 w-3.5 text-rose-200" />
              ) : lastSentId ? (
                <Check className="h-3.5 w-3.5 text-[#a3c5b1]" />
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
              className="flex items-center space-x-1 text-xs font-semibold text-[#1c382b] bg-[#f4f0e6] hover:bg-[#e6ede7] px-3 py-1.5 rounded-2xl border border-[#ded2be] btn-tactile cursor-pointer"
            >
              <RefreshCw className="h-3 w-3 text-[#544733]" />
              <span>Ping</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3 text-xs">
          <div className="bg-[#f5f1e8] p-3 rounded-2xl border border-[#e5dec9] hover:border-[#37543e]/40 transition-colors">
            <span className="text-[#756449] font-medium">Stored Data Points:</span>
            <div className="font-mono text-[#1c382b] font-extrabold text-sm mt-0.5">
              {telemetry.length} document(s)
            </div>
          </div>
          <div className="bg-[#f5f1e8] p-3 rounded-2xl border border-[#e5dec9] hover:border-[#37543e]/40 transition-colors">
            <span className="text-[#756449] font-medium">Ingest API Endpoint:</span>
            <div className="font-mono text-[#24221f] font-semibold mt-0.5">POST /v1/ingest</div>
          </div>
          <div className="bg-[#f5f1e8] p-3 rounded-2xl border border-[#e5dec9] hover:border-[#37543e]/40 transition-colors">
            <span className="text-[#756449] font-medium">Server Latency:</span>
            <div className="font-mono text-[#24221f] font-semibold mt-0.5">
              {latencyMs != null ? `${latencyMs} ms` : "—"}
            </div>
          </div>
          <div className="bg-[#f5f1e8] p-3 rounded-2xl border border-[#e5dec9] hover:border-[#37543e]/40 transition-colors">
            <span className="text-[#756449] font-medium">Service Version:</span>
            <div className="font-mono text-[#1c382b] font-semibold mt-0.5">
              {backendDetails?.version ? `v${backendDetails.version}` : "FastAPI 0.115+"}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards (Warm Beige Card Surface with Organic Green / Sand Accents) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-5 shadow-xs card-hover border-t-4 border-t-[#37543e]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#756449] uppercase tracking-wider">Total Hosts</span>
            <div className="p-2.5 rounded-2xl bg-[#e6ede7] text-[#1c382b] border border-[#cbdccf]">
              <Server className="h-4 w-4 text-[#1c382b]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#1c382b]">{totalHosts}</span>
            <span className="text-xs font-semibold text-[#37543e]">({onlineCount} online)</span>
          </div>
          <div className="mt-2 text-xs text-[#756449] font-medium">Autonomous metadata collectors</div>
        </div>

        <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-5 shadow-xs card-hover border-t-4 border-t-[#b59351]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#756449] uppercase tracking-wider">Active Alerts</span>
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#24221f]">{alerts.length}</span>
            <span className="text-xs font-medium text-[#756449]">in cooldown</span>
          </div>
          <div className="mt-2 text-xs text-[#756449] font-medium">Threshold & EWMA anomaly triggers</div>
        </div>

        <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-5 shadow-xs card-hover border-t-4 border-t-[#9c4242]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#756449] uppercase tracking-wider">AIOps Incidents</span>
            <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-800 border border-rose-200">
              <Activity className="h-4 w-4 text-rose-700" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#24221f]">{incidents.length}</span>
            <span className="text-xs font-semibold text-rose-700">correlated</span>
          </div>
          <div className="mt-2 text-xs text-[#756449] font-medium">Multi-signal 2-minute clustering</div>
        </div>

        <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-5 shadow-xs card-hover border-t-4 border-t-[#60896a]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#756449] uppercase tracking-wider">Privacy Engine</span>
            <div className="p-2.5 rounded-2xl bg-[#e6ede7] text-[#1c382b] border border-[#cbdccf]">
              <ShieldCheck className="h-4 w-4 text-[#1c382b]" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#1c382b]">100%</span>
            <span className="text-xs font-medium text-[#756449]">Allow-list</span>
          </div>
          <div className="mt-2 text-xs text-[#756449] font-medium">0 secrets leaked outside boundary</div>
        </div>
      </div>

      {/* Interactive Host Quick-Finder & Filter Bar */}
      <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#968262]">
              <Search className="h-3.5 w-3.5" />
            </div>
            <input
              type="text"
              value={hostSearch}
              onChange={(e) => setHostSearch(e.target.value)}
              placeholder="Search fleet by collector ID, source ID, or role..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#f4efe6] border border-[#ded2be] rounded-2xl text-[#24221f] placeholder-[#b5a281] focus:bg-[#faf7f2] focus:outline-none focus:ring-2 focus:ring-[#37543e]/20 focus:border-[#37543e] font-medium transition-all"
            />
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#756449] mr-1 hidden sm:inline">
              Filter:
            </span>
            {[
              { id: "all", label: `All (${totalHosts})` },
              { id: "online", label: `Online (${onlineCount})` },
              { id: "fair", label: `Warning (${fairCount})` },
              { id: "poor", label: `Critical (${poorCount})` },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setStatusFilter(btn.id)}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all btn-tactile cursor-pointer ${
                  statusFilter === btn.id
                    ? "bg-[#1c382b] text-[#faf7f2] shadow-2xs"
                    : "bg-[#f4efe6] text-[#544733] hover:bg-[#e6ede7] hover:text-[#1c382b] border border-[#ded2be]"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Results Preview Chips if filter or search active */}
        {(hostSearch || statusFilter !== "all") && (
          <div className="mt-3 pt-3 border-t border-[#eee8dc] flex items-center justify-between text-xs text-[#756449]">
            <span>
              Showing <strong>{filteredCollectors.length}</strong> of <strong>{totalHosts}</strong> host(s)
            </span>
            <button
              onClick={() => {
                setHostSearch("");
                setStatusFilter("all");
              }}
              className="text-[#1c382b] hover:underline font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Snapshot & Security Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Telemetry Snapshot Card with Interactive Inspector */}
        <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-6 shadow-xs card-hover">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-[#1c382b] flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-[#37543e] animate-live-beacon" />
              <span>Live Telemetry Snapshot</span>
            </h3>

            <div className="flex items-center space-x-1.5 bg-[#f0eae0] p-1 rounded-2xl border border-[#ded2be]">
              <button
                onClick={() => setSnapshotView("metrics")}
                className={`flex items-center space-x-1 text-xs px-2.5 py-1 rounded-xl font-bold transition-all btn-tactile cursor-pointer ${
                  snapshotView === "metrics"
                    ? "bg-[#faf7f2] text-[#1c382b] shadow-2xs"
                    : "text-[#756449] hover:text-[#1c382b]"
                }`}
              >
                <Eye className="h-3 w-3" />
                <span>Metrics</span>
              </button>
              <button
                onClick={() => setSnapshotView("json")}
                className={`flex items-center space-x-1 text-xs px-2.5 py-1 rounded-xl font-bold transition-all btn-tactile cursor-pointer ${
                  snapshotView === "json"
                    ? "bg-[#faf7f2] text-[#1c382b] shadow-2xs"
                    : "text-[#756449] hover:text-[#1c382b]"
                }`}
              >
                <Code2 className="h-3 w-3" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          {latestPoint ? (
            snapshotView === "metrics" ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs py-2 border-b border-[#eee8dc] hover:bg-[#f5f0e6]/60 px-2 rounded-xl transition-colors">
                  <span className="text-[#756449] font-medium">Last Received</span>
                  <span className="text-[#24221f] font-mono font-semibold">{latestPoint.event_time_utc}</span>
                </div>
                <div className="flex justify-between items-center text-xs py-2 border-b border-[#eee8dc] hover:bg-[#f5f0e6]/60 px-2 rounded-xl transition-colors">
                  <span className="text-[#756449] font-medium">Active Source</span>
                  <span className="text-[#1c382b] font-mono font-semibold">{latestPoint.source_id} ({latestPoint.source_role})</span>
                </div>
                <div className="flex justify-between items-center text-xs py-2 border-b border-[#eee8dc] hover:bg-[#f5f0e6]/60 px-2 rounded-xl transition-colors">
                  <span className="text-[#756449] font-medium">CPU / RAM / Disk</span>
                  <span className="text-[#24221f] font-mono font-semibold">
                    {latestPoint.metrics?.cpu_percent}% / {latestPoint.metrics?.memory_percent}% / {latestPoint.metrics?.disk_percent}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs py-2 border-b border-[#eee8dc] hover:bg-[#f5f0e6]/60 px-2 rounded-xl transition-colors">
                  <span className="text-[#756449] font-medium">Latency / Packet Loss</span>
                  <span className="text-[#24221f] font-mono font-semibold">
                    {latestPoint.metrics?.net_latency_ms} ms / {latestPoint.metrics?.packet_loss_percent}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="flex justify-end mb-2">
                  <button
                    onClick={handleCopyJson}
                    className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded-xl bg-[#e6ede7] text-[#1c382b] border border-[#cbdccf] btn-tactile cursor-pointer"
                  >
                    {copiedJson ? (
                      <>
                        <Check className="h-3 w-3 text-[#37543e]" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 bg-[#f4efe6] rounded-2xl border border-[#ded2be] text-[11px] font-mono text-[#24221f] overflow-x-auto max-h-56 leading-relaxed">
                  {JSON.stringify(latestPoint, null, 2)}
                </pre>
              </div>
            )
          ) : (
            <div className="text-xs text-[#756449] italic py-8 text-center bg-[#f4efe6] rounded-2xl border border-[#ded2be]">
              Awaiting telemetry from active collectors... Run collector with <code>python -m collector.collector --simulate</code> or click <strong>Send Test Telemetry</strong> above.
            </div>
          )}
        </div>

        {/* Security & Compliance Guard Card */}
        <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-6 shadow-xs card-hover">
          <h3 className="text-base font-bold text-[#1c382b] mb-4">Security & Compliance Guard</h3>
          <div className="space-y-4 text-xs">
            <div className="flex items-center space-x-2.5 text-[#1c382b] bg-[#e6ede7] border border-[#cbdccf] p-3.5 rounded-2xl font-medium shadow-2xs">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#37543e]" />
              <span>Allow-list strictly enforces zero sensitive data egress across all hosts.</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-[#eee8dc] text-[#544733] hover:bg-[#f5f0e6]/60 px-2 rounded-xl transition-colors">
              <span className="text-[#756449] font-medium">Redacted Secrets Count</span>
              <span className="font-mono font-bold text-[#1c382b]">{latestPoint?.security?.secrets_redacted_count ?? 0} locally scrubbed</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-[#eee8dc] text-[#544733] hover:bg-[#f5f0e6]/60 px-2 rounded-xl transition-colors">
              <span className="text-[#756449] font-medium">Failed Logins Tracked</span>
              <span className="font-mono font-bold text-[#24221f]">{latestPoint?.security?.auth_failure_count ?? 0} (count only, no usernames/IPs)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
